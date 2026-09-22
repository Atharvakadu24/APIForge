import type { ApiRequest, HttpMethod, KeyValueEntry, RequestAuth, RequestBodyType } from '../types/request';
import { cloneRequest } from './historyStorage';

export const APIFORGE_SCHEMA_VERSION = 'apiforge-request-v1';

export interface ApiForgeExportFile {
  $schema?: string;
  version: string;
  exportedAt: string;
  source: 'APIForge';
  request: ApiRequest;
}

const VALID_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const VALID_BODY_TYPES: RequestBodyType[] = [
  'none',
  'json',
  'text',
  'x-www-form-urlencoded',
  'multipart/form-data',
];

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

/**
 * Sanitizes an array of KeyValueEntry objects, ensuring required fields and unique IDs.
 */
function sanitizeKeyValueEntries(entries: unknown): KeyValueEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.map((item) => {
    const raw = item && typeof item === 'object' ? item : {};
    return {
      id: typeof (raw as any).id === 'string' && (raw as any).id ? (raw as any).id : generateId(),
      key: typeof (raw as any).key === 'string' ? (raw as any).key : '',
      value: typeof (raw as any).value === 'string' ? (raw as any).value : '',
      enabled: typeof (raw as any).enabled === 'boolean' ? (raw as any).enabled : true,
      description: typeof (raw as any).description === 'string' ? (raw as any).description : '',
    };
  });
}

/**
 * Sanitizes authentication configuration.
 */
function sanitizeAuth(rawAuth: unknown): RequestAuth {
  if (!rawAuth || typeof rawAuth !== 'object') {
    return { type: 'none' };
  }
  const auth = rawAuth as any;
  const type = auth.type === 'bearer' || auth.type === 'apiKey' ? auth.type : 'none';

  if (type === 'bearer') {
    return {
      type: 'bearer',
      bearer: {
        token: typeof auth.bearer?.token === 'string' ? auth.bearer.token : '',
      },
    };
  }

  if (type === 'apiKey') {
    return {
      type: 'apiKey',
      apiKey: {
        key: typeof auth.apiKey?.key === 'string' ? auth.apiKey.key : '',
        value: typeof auth.apiKey?.value === 'string' ? auth.apiKey.value : '',
        addTo: auth.apiKey?.addTo === 'query' ? 'query' : 'header',
      },
    };
  }

  return { type: 'none' };
}

/**
 * Serializes an ApiRequest into the standard APIForge export JSON string.
 * Preserves variable templates (e.g. {{baseUrl}}, {{token}}).
 * Excludes Supabase session tokens or application state.
 */
export function exportRequestToJson(request: ApiRequest): string {
  const cleanRequest = cloneRequest(request);

  const exportPayload: ApiForgeExportFile = {
    $schema: 'https://apiforge.dev/schemas/request-v1.json',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    source: 'APIForge',
    request: cleanRequest,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Triggers a browser file download of the exported request JSON.
 */
export function downloadRequestJsonFile(request: ApiRequest, customFileName?: string): void {
  const jsonContent = exportRequestToJson(request);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  let defaultName = 'apiforge-request';
  if (request.url) {
    try {
      // If URL starts with http(s)
      const u = new URL(request.url.replace(/\{\{[^}]+\}\}/g, 'var'));
      defaultName = `request-${u.hostname.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    } catch {
      // If template URL or relative
      defaultName = 'apiforge-request';
    }
  }

  const fileName = (customFileName || `${defaultName}-${Date.now()}`).replace(/\.json$/i, '') + '.json';

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ImportParseResult =
  | { success: true; request: ApiRequest; sourceVersion?: string }
  | { success: false; error: string };

/**
 * Parses and validates raw JSON input into an ApiRequest.
 * Enforces the APIForge export structure, required request object, and required fields (method, URL).
 */
export function validateAndParseImportedJson(jsonStr: string): ImportParseResult {
  if (!jsonStr || !jsonStr.trim()) {
    return { success: false, error: 'Please select or paste a JSON file to import.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON syntax';
    return { success: false, error: `JSON Parse Error: ${msg}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, error: 'Import file must contain a valid JSON object.' };
  }

  const data = parsed as Record<string, unknown>;

  // 1. Require the APIForge export structure containing the "request" object
  if (!('request' in data)) {
    return {
      success: false,
      error: 'Invalid APIForge export format: Missing required "request" object.',
    };
  }

  if (!data.request || typeof data.request !== 'object' || Array.isArray(data.request)) {
    return {
      success: false,
      error: 'Invalid APIForge export format: "request" field must be an object.',
    };
  }

  const candidateReq = data.request as Record<string, unknown>;

  // 2. Validate required "method" field - Do NOT silently default missing method
  if (!('method' in candidateReq) || candidateReq.method === undefined || candidateReq.method === null) {
    return {
      success: false,
      error: 'Invalid APIForge request: Missing required "method" field.',
    };
  }

  if (typeof candidateReq.method !== 'string' || !candidateReq.method.trim()) {
    return {
      success: false,
      error: 'Invalid APIForge request: "method" must be a non-empty string.',
    };
  }

  const rawMethod = candidateReq.method.trim().toUpperCase();
  if (!VALID_METHODS.includes(rawMethod as HttpMethod)) {
    return {
      success: false,
      error: `Unsupported HTTP method "${candidateReq.method}". Allowed methods: ${VALID_METHODS.join(', ')}.`,
    };
  }
  const method = rawMethod as HttpMethod;

  // 3. Validate required "url" field - Do NOT silently default missing URL
  if (!('url' in candidateReq) || candidateReq.url === undefined || candidateReq.url === null) {
    return {
      success: false,
      error: 'Invalid APIForge request: Missing required "url" field.',
    };
  }

  if (typeof candidateReq.url !== 'string') {
    return {
      success: false,
      error: 'Invalid APIForge request: "url" must be a string.',
    };
  }

  const trimmedUrl = candidateReq.url.trim();
  if (trimmedUrl.length === 0) {
    return {
      success: false,
      error: 'Invalid APIForge request: "url" cannot be empty.',
    };
  }
  const url = candidateReq.url;

  // 4. Validate bodyType (if present)
  let bodyType: RequestBodyType = 'none';
  if ('bodyType' in candidateReq && candidateReq.bodyType !== undefined && candidateReq.bodyType !== null) {
    if (typeof candidateReq.bodyType !== 'string') {
      return {
        success: false,
        error: 'Invalid APIForge request: "bodyType" must be a string.',
      };
    }
    let rawBodyType = candidateReq.bodyType.trim().toLowerCase();
    if (rawBodyType === 'urlencoded') rawBodyType = 'x-www-form-urlencoded';
    if (rawBodyType === 'form-data') rawBodyType = 'multipart/form-data';

    if (!VALID_BODY_TYPES.includes(rawBodyType as RequestBodyType)) {
      return {
        success: false,
        error: `Unsupported body type "${candidateReq.bodyType}". Allowed types: ${VALID_BODY_TYPES.join(', ')}.`,
      };
    }
    bodyType = rawBodyType as RequestBodyType;
  }

  // 5. Validate queryParams (if present, must be an array)
  if ('queryParams' in candidateReq && candidateReq.queryParams !== undefined && candidateReq.queryParams !== null) {
    if (!Array.isArray(candidateReq.queryParams)) {
      return {
        success: false,
        error: 'Invalid APIForge request: "queryParams" must be an array.',
      };
    }
  }

  // 6. Validate headers (if present, must be an array)
  if ('headers' in candidateReq && candidateReq.headers !== undefined && candidateReq.headers !== null) {
    if (!Array.isArray(candidateReq.headers)) {
      return {
        success: false,
        error: 'Invalid APIForge request: "headers" must be an array.',
      };
    }
  }

  // 7. Validate formUrlEncoded (if present, must be an array)
  if ('formUrlEncoded' in candidateReq && candidateReq.formUrlEncoded !== undefined && candidateReq.formUrlEncoded !== null) {
    if (!Array.isArray(candidateReq.formUrlEncoded)) {
      return {
        success: false,
        error: 'Invalid APIForge request: "formUrlEncoded" must be an array.',
      };
    }
  }

  // 8. Validate multipartFormData (if present, must be an array)
  if ('multipartFormData' in candidateReq && candidateReq.multipartFormData !== undefined && candidateReq.multipartFormData !== null) {
    if (!Array.isArray(candidateReq.multipartFormData)) {
      return {
        success: false,
        error: 'Invalid APIForge request: "multipartFormData" must be an array.',
      };
    }
  }

  // 9. Validate auth (if present, must be an object)
  if ('auth' in candidateReq && candidateReq.auth !== undefined && candidateReq.auth !== null) {
    if (typeof candidateReq.auth !== 'object' || Array.isArray(candidateReq.auth)) {
      return {
        success: false,
        error: 'Invalid APIForge request: "auth" must be an object.',
      };
    }
    const rawAuth = candidateReq.auth as Record<string, unknown>;
    if (rawAuth.type !== undefined && rawAuth.type !== null) {
      if (typeof rawAuth.type !== 'string' || !['none', 'bearer', 'apiKey'].includes(rawAuth.type)) {
        return {
          success: false,
          error: `Unsupported auth type "${rawAuth.type}". Allowed types: none, bearer, apiKey.`,
        };
      }
    }
  }

  // 10. Validate body (if present, must be a string)
  if ('body' in candidateReq && candidateReq.body !== undefined && candidateReq.body !== null) {
    if (typeof candidateReq.body !== 'string') {
      return {
        success: false,
        error: 'Invalid APIForge request: "body" must be a string.',
      };
    }
  }

  // Sanitize components
  const queryParams = sanitizeKeyValueEntries(candidateReq.queryParams);
  const headers = sanitizeKeyValueEntries(candidateReq.headers);
  const formUrlEncoded = sanitizeKeyValueEntries(candidateReq.formUrlEncoded);
  const multipartFormData = sanitizeKeyValueEntries(candidateReq.multipartFormData);
  const body = typeof candidateReq.body === 'string' ? candidateReq.body : '';
  const auth = sanitizeAuth(candidateReq.auth);

  const sanitizedRequest: ApiRequest = {
    method,
    url,
    queryParams,
    headers,
    bodyType,
    body,
    formUrlEncoded,
    multipartFormData,
    auth,
  };

  const sourceVersion = typeof data.version === 'string' ? data.version : undefined;

  return {
    success: true,
    request: sanitizedRequest,
    sourceVersion,
  };
}
