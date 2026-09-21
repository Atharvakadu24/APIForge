import type { ApiRequest, KeyValueEntry, RequestAuth, RequestBodyType } from '../types/request';

/**
 * Generates a stable unique ID for query param entries.
 */
export const generateParamId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

/**
 * Safely decodes a URI component without throwing on malformed percent encoding.
 */
export function safeDecodeParam(str: string): string {
  if (!str) return '';
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch {
    return str;
  }
}

/**
 * Encodes a query component for URL usage while preserving {{variable}} templates.
 */
export function encodeQueryComponent(str: string): string {
  if (!str) return '';
  return encodeURIComponent(str).replace(/%7B%7B([a-zA-Z0-9_\-.]+)%7D%7D/g, '{{$1}}');
}

export interface ParsedUrlComponents {
  baseUrl: string;
  hash: string;
  params: Array<{ key: string; value: string }>;
}

/**
 * Parses a URL string into its base URL, hash fragment, and query parameters.
 * Supports URL-encoded values, repeated query parameters, empty values, and template variables.
 */
export function parseUrlQueryParams(url: string): ParsedUrlComponents {
  if (!url || typeof url !== 'string') {
    return { baseUrl: '', hash: '', params: [] };
  }

  // 1. Separate fragment (#hash)
  const hashIndex = url.indexOf('#');
  const hash = hashIndex !== -1 ? url.substring(hashIndex) : '';
  const urlWithoutHash = hashIndex !== -1 ? url.substring(0, hashIndex) : url;

  // 2. Separate query string (?query)
  const questionIndex = urlWithoutHash.indexOf('?');
  if (questionIndex === -1) {
    return {
      baseUrl: urlWithoutHash,
      hash,
      params: [],
    };
  }

  const baseUrl = urlWithoutHash.substring(0, questionIndex);
  const rawQueryString = urlWithoutHash.substring(questionIndex + 1);

  if (!rawQueryString) {
    return {
      baseUrl,
      hash,
      params: [],
    };
  }

  // 3. Split by '&' and parse each key-value pair
  const pairs = rawQueryString.split('&');
  const params: Array<{ key: string; value: string }> = [];

  for (const pair of pairs) {
    if (!pair) continue; // Skip empty segments like '&&'
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      params.push({
        key: safeDecodeParam(pair),
        value: '',
      });
    } else {
      params.push({
        key: safeDecodeParam(pair.substring(0, eqIndex)),
        value: safeDecodeParam(pair.substring(eqIndex + 1)),
      });
    }
  }

  return {
    baseUrl,
    hash,
    params,
  };
}

/**
 * Builds a synchronized URL string from a base URL / existing URL and query parameters.
 * Only enabled parameters are included in the effective URL.
 * Preserves protocol, hostname, path, fragments (#hash), and {{variable}} templates.
 */
export function buildUrlWithParams(baseUrlOrUrl: string, params: KeyValueEntry[]): string {
  const rawUrl = baseUrlOrUrl || '';

  // Extract base URL before '?' or '#'
  const hashIndex = rawUrl.indexOf('#');
  const hash = hashIndex !== -1 ? rawUrl.substring(hashIndex) : '';
  const withoutHash = hashIndex !== -1 ? rawUrl.substring(0, hashIndex) : rawUrl;

  const qIndex = withoutHash.indexOf('?');
  const baseUrl = qIndex !== -1 ? withoutHash.substring(0, qIndex) : withoutHash;

  // Filter only enabled parameters that have a non-empty key or value
  const enabledParams = (params || []).filter(
    (p) => p.enabled && (p.key.trim() !== '' || p.value.trim() !== '')
  );

  if (enabledParams.length === 0) {
    return `${baseUrl}${hash}`;
  }

  const queryString = enabledParams
    .map((p) => {
      const key = encodeQueryComponent(p.key.trim());
      if (!p.value) {
        return key;
      }
      return `${key}=${encodeQueryComponent(p.value)}`;
    })
    .join('&');

  return `${baseUrl}?${queryString}${hash}`;
}

/**
 * Synchronizes URL query parameters with the structured queryParams array.
 * Reconciles parsed URL parameters with existing params to preserve IDs and disabled entries.
 */
export function syncUrlToParams(
  url: string,
  existingParams: KeyValueEntry[]
): KeyValueEntry[] {
  const { params: parsedPairs } = parseUrlQueryParams(url);
  const current = existingParams || [];

  // Split current into enabled and disabled
  const disabledParams = current.filter((p) => !p.enabled);
  const enabledParams = current.filter((p) => p.enabled);

  // Pool of available enabled params to match by key and value to reuse IDs
  const availablePool = [...enabledParams];
  const newEnabledParams: KeyValueEntry[] = [];

  for (const pair of parsedPairs) {
    // Try to find exact key + value match first in pool
    let matchIdx = availablePool.findIndex(
      (p) => p.key === pair.key && p.value === pair.value
    );

    // If no exact match, try matching by key
    if (matchIdx === -1) {
      matchIdx = availablePool.findIndex((p) => p.key === pair.key);
    }

    if (matchIdx !== -1) {
      const matched = availablePool.splice(matchIdx, 1)[0];
      newEnabledParams.push({
        id: matched.id,
        key: pair.key,
        value: pair.value,
        enabled: true,
        description: matched.description || '',
      });
    } else {
      // New parameter from URL
      newEnabledParams.push({
        id: generateParamId(),
        key: pair.key,
        value: pair.value,
        enabled: true,
        description: '',
      });
    }
  }

  // Return reconciled enabled parameters followed by existing disabled parameters
  return [...newEnabledParams, ...disabledParams];
}

/**
 * Normalizes key-value entries for stable deep comparison,
 * ignoring empty/placeholder rows and transient IDs.
 */
function normalizeEntries(entries: KeyValueEntry[] = []): Array<{
  key: string;
  value: string;
  enabled: boolean;
  description: string;
}> {
  return entries
    .filter((e) => e.key.trim() !== '' || e.value.trim() !== '' || (e.description && e.description.trim() !== ''))
    .map((e) => ({
      key: e.key.trim(),
      value: e.value,
      enabled: !!e.enabled,
      description: e.description?.trim() || '',
    }));
}

/**
 * Normalizes body content based on bodyType.
 */
function normalizeBody(bodyType: RequestBodyType, body: string): string {
  if (bodyType === 'none') return '';
  return (body || '').trim();
}

/**
 * Normalizes authentication configuration for stable comparison.
 */
function normalizeAuth(auth?: RequestAuth): string {
  if (!auth || auth.type === 'none') return 'type:none';
  if (auth.type === 'bearer') {
    return `type:bearer;token:${(auth.bearer?.token || '').trim()}`;
  }
  if (auth.type === 'apiKey') {
    return `type:apiKey;key:${(auth.apiKey?.key || '').trim()};value:${(auth.apiKey?.value || '').trim()};addTo:${auth.apiKey?.addTo || 'header'}`;
  }
  return 'type:none';
}

/**
 * Determines whether the current editor request differs meaningfully from a saved request.
 * Compares method, URL, queryParams, headers, bodyType, body, and auth.
 * Ignores UI transient states (active tab, response, loading state, modals).
 */
export function isRequestDirty(
  current: ApiRequest,
  saved: ApiRequest | null | undefined
): boolean {
  if (!saved) {
    return false;
  }

  // 1. Method
  if ((current.method || 'GET') !== (saved.method || 'GET')) {
    return true;
  }

  // 2. URL (trimmed)
  if ((current.url || '').trim() !== (saved.url || '').trim()) {
    return true;
  }

  // 3. Query Parameters
  const currentParams = normalizeEntries(current.queryParams);
  const savedParams = normalizeEntries(saved.queryParams);
  if (JSON.stringify(currentParams) !== JSON.stringify(savedParams)) {
    return true;
  }

  // 4. Headers
  const currentHeaders = normalizeEntries(current.headers);
  const savedHeaders = normalizeEntries(saved.headers);
  if (JSON.stringify(currentHeaders) !== JSON.stringify(savedHeaders)) {
    return true;
  }

  // 5. Body Type
  if ((current.bodyType || 'none') !== (saved.bodyType || 'none')) {
    return true;
  }

  // 6. Body
  if (
    normalizeBody(current.bodyType, current.body) !==
    normalizeBody(saved.bodyType, saved.body)
  ) {
    return true;
  }

  // 7. Form URL Encoded fields
  if (current.bodyType === 'x-www-form-urlencoded' || saved.bodyType === 'x-www-form-urlencoded') {
    const currentFormUrlEncoded = normalizeEntries(current.formUrlEncoded);
    const savedFormUrlEncoded = normalizeEntries(saved.formUrlEncoded);
    if (JSON.stringify(currentFormUrlEncoded) !== JSON.stringify(savedFormUrlEncoded)) {
      return true;
    }
  }

  // 8. Multipart Form Data fields
  if (current.bodyType === 'multipart/form-data' || saved.bodyType === 'multipart/form-data') {
    const currentMultipart = normalizeEntries(current.multipartFormData);
    const savedMultipart = normalizeEntries(saved.multipartFormData);
    if (JSON.stringify(currentMultipart) !== JSON.stringify(savedMultipart)) {
      return true;
    }
  }

  // 9. Authentication
  if (normalizeAuth(current.auth) !== normalizeAuth(saved.auth)) {
    return true;
  }

  return false;
}
