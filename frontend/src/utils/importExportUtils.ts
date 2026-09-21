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
 * Supports both wrapped `{ request: { ... } }` and unwrapped `{ method, url, ... }` formats.
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

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'Import file must contain a JSON object.' };
  }

  const data = parsed as Record<string, unknown>;

  // Check if wrapped in export envelope
  const candidateReq =
    data.request && typeof data.request === 'object'
      ? (data.request as Record<string, unknown>)
      : data;

  // Validate HTTP Method
  const rawMethod = typeof candidateReq.method === 'string' ? candidateReq.method.toUpperCase() : 'GET';
  if (!VALID_METHODS.includes(rawMethod as HttpMethod)) {
    return {
      success: false,
      error: `Unsupported HTTP method "${candidateReq.method}". Allowed methods: ${VALID_METHODS.join(', ')}.`,
    };
  }
  const method = rawMethod as HttpMethod;

  // Validate URL
  const url = typeof candidateReq.url === 'string' ? candidateReq.url : '';

  // Validate Body Type
  let rawBodyType = typeof candidateReq.bodyType === 'string' ? candidateReq.bodyType.toLowerCase() : 'none';
  if (rawBodyType === 'urlencoded') rawBodyType = 'x-www-form-urlencoded';
  if (rawBodyType === 'form-data') rawBodyType = 'multipart/form-data';

  if (!VALID_BODY_TYPES.includes(rawBodyType as RequestBodyType)) {
    return {
      success: false,
      error: `Unsupported body type "${candidateReq.bodyType}". Allowed types: ${VALID_BODY_TYPES.join(', ')}.`,
    };
  }
  const bodyType = rawBodyType as RequestBodyType;

  // Validate and sanitize components
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
