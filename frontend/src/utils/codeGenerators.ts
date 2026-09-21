import type { ApiRequest, KeyValueEntry, RequestBodyType } from '../types/request';

export type SupportedSnippetLanguage = 'curl' | 'fetch' | 'python' | 'axios';

export interface LanguageOption {
  id: SupportedSnippetLanguage;
  label: string;
  syntax: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: 'curl', label: 'cURL', syntax: 'bash' },
  { id: 'fetch', label: 'JavaScript — fetch', syntax: 'javascript' },
  { id: 'python', label: 'Python — requests', syntax: 'python' },
  { id: 'axios', label: 'Axios', syntax: 'javascript' },
];

/**
 * Normalizes and extracts active headers, query params, and body from an ApiRequest,
 * injecting authentication and content-type headers without resolving {{variables}}.
 */
export interface NormalizedRequestData {
  method: string;
  url: string;
  fullUrl: string;
  queryParams: Array<{ key: string; value: string }>;
  headers: Array<{ key: string; value: string }>;
  body: string | null;
  bodyType: RequestBodyType;
  formUrlEncoded: Array<{ key: string; value: string }>;
  multipartFormData: Array<{ key: string; value: string }>;
}

export function normalizeRequest(request: ApiRequest): NormalizedRequestData {
  const method = (request.method || 'GET').toUpperCase();
  const rawUrl = request.url ? request.url.trim() : '';
  const fallbackUrl = 'https://api.example.com';

  // Extract base URL without query string for languages like Python/Axios that pass params separately
  const qIndex = rawUrl.indexOf('?');
  const baseUrl = qIndex !== -1 ? rawUrl.substring(0, qIndex) : (rawUrl || fallbackUrl);

  // 1. Collect enabled query parameters
  const queryParams: Array<{ key: string; value: string }> = (request.queryParams || [])
    .filter((p: KeyValueEntry) => p.enabled && p.key.trim() !== '')
    .map((p: KeyValueEntry) => ({ key: p.key.trim(), value: p.value }));

  // 2. Collect enabled headers
  let headers: Array<{ key: string; value: string }> = (request.headers || [])
    .filter((h: KeyValueEntry) => h.enabled && h.key.trim() !== '')
    .map((h: KeyValueEntry) => ({ key: h.key.trim(), value: h.value }));

  // 3. Inject Authentication
  if (request.auth) {
    if (request.auth.type === 'bearer') {
      const token = request.auth.bearer?.token?.trim() || 'YOUR_BEARER_TOKEN';
      const existingAuthIndex = headers.findIndex((h) => h.key.toLowerCase() === 'authorization');
      if (existingAuthIndex >= 0) {
        headers[existingAuthIndex] = { key: 'Authorization', value: `Bearer ${token}` };
      } else {
        headers.push({ key: 'Authorization', value: `Bearer ${token}` });
      }
    } else if (request.auth.type === 'apiKey') {
      const keyName = request.auth.apiKey?.key?.trim() || 'X-API-Key';
      const keyValue = request.auth.apiKey?.value?.trim() || 'YOUR_API_KEY';
      const addTo = request.auth.apiKey?.addTo || 'header';

      if (addTo === 'header') {
        const existingIndex = headers.findIndex((h) => h.key.toLowerCase() === keyName.toLowerCase());
        if (existingIndex >= 0) {
          headers[existingIndex] = { key: keyName, value: keyValue };
        } else {
          headers.push({ key: keyName, value: keyValue });
        }
      } else if (addTo === 'query') {
        const queryKey = request.auth.apiKey?.key?.trim() || 'api_key';
        const existingIndex = queryParams.findIndex((p) => p.key.toLowerCase() === queryKey.toLowerCase());
        if (existingIndex >= 0) {
          queryParams[existingIndex] = { key: queryKey, value: keyValue };
        } else {
          queryParams.push({ key: queryKey, value: keyValue });
        }
      }
    }
  }

  // 4. Collect Form URL Encoded and Multipart entries
  const formUrlEncoded: Array<{ key: string; value: string }> = (request.formUrlEncoded || [])
    .filter((f: KeyValueEntry) => f.enabled && f.key.trim() !== '')
    .map((f: KeyValueEntry) => ({ key: f.key.trim(), value: f.value }));

  const multipartFormData: Array<{ key: string; value: string }> = (request.multipartFormData || [])
    .filter((f: KeyValueEntry) => f.enabled && f.key.trim() !== '')
    .map((f: KeyValueEntry) => ({ key: f.key.trim(), value: f.value }));

  // 5. Handle Body & Content-Type header
  let body: string | null = null;
  const bodyType = request.bodyType || 'none';

  if (bodyType === 'json') {
    if (request.body && request.body.trim().length > 0) {
      body = request.body.trim();
    }
    const hasContentType = headers.some((h) => h.key.toLowerCase() === 'content-type');
    if (!hasContentType) {
      headers.push({ key: 'Content-Type', value: 'application/json' });
    }
  } else if (bodyType === 'text') {
    if (request.body && request.body.trim().length > 0) {
      body = request.body.trim();
    }
    const hasContentType = headers.some((h) => h.key.toLowerCase() === 'content-type');
    if (!hasContentType) {
      headers.push({ key: 'Content-Type', value: 'text/plain' });
    }
  } else if (bodyType === 'x-www-form-urlencoded') {
    // Strip conflicting Content-Type (such as default application/json) and ensure application/x-www-form-urlencoded
    headers = headers.filter((h) => h.key.toLowerCase() !== 'content-type');
    headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
  } else if (bodyType === 'multipart/form-data') {
    // For multipart/form-data, strip manual Content-Type header so the runtime boundary is generated cleanly
    headers = headers.filter((h) => h.key.toLowerCase() !== 'content-type');
  }

  // 6. Build full URL with query parameters
  let fullUrl = rawUrl || fallbackUrl;
  if (!fullUrl.includes('?') && queryParams.length > 0) {
    const qs = queryParams.map((p) => `${p.key}=${p.value}`).join('&');
    fullUrl = `${baseUrl}?${qs}`;
  }

  return {
    method,
    url: baseUrl,
    fullUrl,
    queryParams,
    headers,
    body,
    bodyType,
    formUrlEncoded,
    multipartFormData,
  };
}

/**
 * Escapes single quotes for shell/cURL execution.
 */
function escapeShellSingleQuotes(str: string): string {
  return str.replace(/'/g, `'\\''`);
}

/**
 * Generates a multiline, readable cURL command.
 */
export function generateCurl(request: ApiRequest): string {
  const { method, fullUrl, headers, body, bodyType, formUrlEncoded, multipartFormData } =
    normalizeRequest(request);

  const parts: string[] = [`curl --request ${method}`, `  --url '${escapeShellSingleQuotes(fullUrl)}'`];

  for (const h of headers) {
    parts.push(`  --header '${escapeShellSingleQuotes(`${h.key}: ${h.value}`)}'`);
  }

  if (bodyType === 'x-www-form-urlencoded') {
    if (formUrlEncoded.length > 0) {
      for (const field of formUrlEncoded) {
        parts.push(
          `  --data-urlencode '${escapeShellSingleQuotes(`${field.key}=${field.value}`)}'`
        );
      }
    }
  } else if (bodyType === 'multipart/form-data') {
    if (multipartFormData.length > 0) {
      for (const field of multipartFormData) {
        parts.push(
          `  --form '${escapeShellSingleQuotes(`${field.key}=${field.value}`)}'`
        );
      }
    }
  } else if (body) {
    parts.push(`  --data '${escapeShellSingleQuotes(body)}'`);
  }

  return parts.join(' \\\n');
}

/**
 * Generates modern JavaScript fetch code with async/await.
 */
export function generateFetch(request: ApiRequest): string {
  const { method, fullUrl, headers, body, bodyType, formUrlEncoded, multipartFormData } =
    normalizeRequest(request);

  const hasHeaders = headers.length > 0;
  const hasBody =
    bodyType === 'x-www-form-urlencoded'
      ? formUrlEncoded.length > 0
      : bodyType === 'multipart/form-data'
      ? multipartFormData.length > 0
      : Boolean(body);

  const isSimpleGet = method === 'GET' && !hasHeaders && !hasBody;

  if (isSimpleGet) {
    return `try {
  const response = await fetch('${fullUrl}');
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Fetch error:', error);
}`;
  }

  const prepLines: string[] = [];
  const optionsEntries: string[] = [`  method: '${method}',`];

  if (hasHeaders) {
    const headerLines = headers.map((h) => `    '${h.key}': '${h.value.replace(/'/g, "\\'")}',`);
    optionsEntries.push(`  headers: {\n${headerLines.join('\n')}\n  },`);
  }

  if (bodyType === 'x-www-form-urlencoded') {
    if (formUrlEncoded.length > 0) {
      prepLines.push('const urlencoded = new URLSearchParams();');
      for (const field of formUrlEncoded) {
        prepLines.push(
          `urlencoded.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)});`
        );
      }
      prepLines.push('');
      optionsEntries.push('  body: urlencoded,');
    }
  } else if (bodyType === 'multipart/form-data') {
    if (multipartFormData.length > 0) {
      prepLines.push('const formData = new FormData();');
      for (const field of multipartFormData) {
        prepLines.push(
          `formData.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)});`
        );
      }
      prepLines.push('');
      optionsEntries.push('  body: formData,');
    }
  } else if (hasBody && body) {
    if (bodyType === 'json') {
      try {
        const parsed = JSON.parse(body);
        const formatted = JSON.stringify(parsed, null, 2)
          .split('\n')
          .map((line, idx) => (idx === 0 ? line : `    ${line}`))
          .join('\n');
        optionsEntries.push(`  body: JSON.stringify(${formatted}),`);
      } catch {
        optionsEntries.push(`  body: JSON.stringify(${JSON.stringify(body)}),`);
      }
    } else {
      optionsEntries.push(`  body: ${JSON.stringify(body)},`);
    }
  }

  const prepSection = prepLines.length > 0 ? `${prepLines.join('\n')}\n` : '';

  return `${prepSection}const url = '${fullUrl}';
const options = {
${optionsEntries.join('\n')}
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Fetch error:', error);
}`;
}

/**
 * Generates Python requests snippet.
 */
export function generatePythonRequests(request: ApiRequest): string {
  const { method, url, queryParams, headers, body, bodyType, formUrlEncoded, multipartFormData } =
    normalizeRequest(request);

  const lines: string[] = ['import requests', '', `url = "${url}"`, ''];
  const requestArgs: string[] = [`"${method}"`, 'url'];

  if (queryParams.length > 0) {
    const paramLines = queryParams.map(
      (p) => `    "${p.key.replace(/"/g, '\\"')}": "${p.value.replace(/"/g, '\\"')}",`
    );
    lines.push(`params = {\n${paramLines.join('\n')}\n}`);
    lines.push('');
    requestArgs.push('params=params');
  }

  if (headers.length > 0) {
    const headerLines = headers.map(
      (h) => `    "${h.key.replace(/"/g, '\\"')}": "${h.value.replace(/"/g, '\\"')}",`
    );
    lines.push(`headers = {\n${headerLines.join('\n')}\n}`);
    lines.push('');
    requestArgs.push('headers=headers');
  }

  if (bodyType === 'x-www-form-urlencoded') {
    if (formUrlEncoded.length > 0) {
      const fieldLines = formUrlEncoded.map(
        (f) => `    "${f.key.replace(/"/g, '\\"')}": "${f.value.replace(/"/g, '\\"')}",`
      );
      lines.push(`payload = {\n${fieldLines.join('\n')}\n}`);
      lines.push('');
      requestArgs.push('data=payload');
    }
  } else if (bodyType === 'multipart/form-data') {
    if (multipartFormData.length > 0) {
      const fileLines = multipartFormData.map(
        (f) => `    "${f.key.replace(/"/g, '\\"')}": (None, "${f.value.replace(/"/g, '\\"')}"),`
      );
      lines.push(`files = {\n${fileLines.join('\n')}\n}`);
      lines.push('');
      requestArgs.push('files=files');
    }
  } else if (body) {
    if (bodyType === 'json') {
      try {
        const parsed = JSON.parse(body);
        const jsonFormatted = JSON.stringify(parsed, null, 4)
          .replace(/: true/g, ': True')
          .replace(/: false/g, ': False')
          .replace(/: null/g, ': None');
        lines.push(`payload = ${jsonFormatted}`);
        lines.push('');
        requestArgs.push('json=payload');
      } catch {
        lines.push(`payload = """${body.replace(/"""/g, '\\"\\"\\"')}"""`);
        lines.push('');
        requestArgs.push('data=payload');
      }
    } else {
      lines.push(`payload = """${body.replace(/"""/g, '\\"\\"\\"')}"""`);
      lines.push('');
      requestArgs.push('data=payload');
    }
  }

  lines.push(`response = requests.request(${requestArgs.join(', ')})`);
  lines.push('');
  lines.push('print(response.text)');

  return lines.join('\n');
}

/**
 * Generates Axios snippet.
 */
export function generateAxios(request: ApiRequest): string {
  const { method, url, queryParams, headers, body, bodyType, formUrlEncoded, multipartFormData } =
    normalizeRequest(request);

  const prepLines: string[] = [];
  const configLines: string[] = [`  method: '${method}',`, `  url: '${url}',`];

  if (queryParams.length > 0) {
    const paramLines = queryParams.map(
      (p) => `    '${p.key.replace(/'/g, "\\'")}': '${p.value.replace(/'/g, "\\'")}',`
    );
    configLines.push(`  params: {\n${paramLines.join('\n')}\n  },`);
  }

  if (headers.length > 0) {
    const headerLines = headers.map(
      (h) => `    '${h.key.replace(/'/g, "\\'")}': '${h.value.replace(/'/g, "\\'")}',`
    );
    configLines.push(`  headers: {\n${headerLines.join('\n')}\n  },`);
  }

  if (bodyType === 'x-www-form-urlencoded') {
    if (formUrlEncoded.length > 0) {
      prepLines.push('const params = new URLSearchParams();');
      for (const field of formUrlEncoded) {
        prepLines.push(
          `params.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)});`
        );
      }
      prepLines.push('');
      configLines.push('  data: params,');
    }
  } else if (bodyType === 'multipart/form-data') {
    if (multipartFormData.length > 0) {
      prepLines.push('const formData = new FormData();');
      for (const field of multipartFormData) {
        prepLines.push(
          `formData.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)});`
        );
      }
      prepLines.push('');
      configLines.push('  data: formData,');
    }
  } else if (body) {
    if (bodyType === 'json') {
      try {
        const parsed = JSON.parse(body);
        const formatted = JSON.stringify(parsed, null, 2)
          .split('\n')
          .map((line, idx) => (idx === 0 ? line : `    ${line}`))
          .join('\n');
        configLines.push(`  data: ${formatted},`);
      } catch {
        configLines.push(`  data: ${JSON.stringify(body)},`);
      }
    } else {
      configLines.push(`  data: ${JSON.stringify(body)},`);
    }
  }

  const prepSection = prepLines.length > 0 ? `${prepLines.join('\n')}\n` : '';

  return `import axios from 'axios';

${prepSection}const options = {
${configLines.join('\n')}
};

try {
  const response = await axios.request(options);
  console.log(response.data);
} catch (error) {
  console.error('Axios error:', error);
}`;
}

/**
 * Dispatcher function to generate code for any supported language.
 */
export function generateSnippet(language: SupportedSnippetLanguage, request: ApiRequest): string {
  switch (language) {
    case 'curl':
      return generateCurl(request);
    case 'fetch':
      return generateFetch(request);
    case 'python':
      return generatePythonRequests(request);
    case 'axios':
      return generateAxios(request);
    default:
      return generateCurl(request);
  }
}
