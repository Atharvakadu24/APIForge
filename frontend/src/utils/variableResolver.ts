import type { ApiRequest } from '../types/request';
import type { Environment, ResolutionResult, UnresolvedVariable } from '../types/environment';
import { cloneRequest } from './historyStorage';

/**
 * Builds a key-value dictionary from all enabled variables in an environment.
 */
export function buildVariableMap(environment: Environment | null): Record<string, string> {
  if (!environment || !Array.isArray(environment.variables)) {
    return {};
  }
  const map: Record<string, string> = {};
  for (const v of environment.variables) {
    if (v.enabled && v.name.trim()) {
      map[v.name.trim()] = v.value;
    }
  }
  return map;
}

/**
 * Replaces {{variable_name}} placeholders in a string.
 * Collects any placeholders that cannot be resolved in the variable map.
 */
export function substituteText(
  text: string,
  varMap: Record<string, string>,
  location: string,
  unresolvedList: UnresolvedVariable[]
): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text.replace(/\{\{([a-zA-Z0-9_\-.]+)\}\}/g, (match, varName) => {
    const trimmedName = varName.trim();
    if (Object.prototype.hasOwnProperty.call(varMap, trimmedName)) {
      return varMap[trimmedName];
    }
    unresolvedList.push({ name: trimmedName, location });
    return match;
  });
}

/**
 * Resolves all environment variables in an ApiRequest without mutating the original.
 * Returns the resolved request clone and any unresolved variables detected.
 */
export function resolveApiRequest(
  request: ApiRequest,
  environment: Environment | null
): ResolutionResult {
  const varMap = buildVariableMap(environment);
  const unresolved: UnresolvedVariable[] = [];

  // Deep clone first to guarantee immutability
  const cloned = cloneRequest(request);

  // 1. Resolve URL
  cloned.url = substituteText(cloned.url, varMap, 'URL', unresolved);

  // 2. Resolve Query Parameters (for enabled rows)
  cloned.queryParams = cloned.queryParams.map((param) => {
    if (!param.enabled) return param;
    return {
      ...param,
      key: substituteText(param.key, varMap, 'Query Param Key', unresolved),
      value: substituteText(param.value, varMap, 'Query Param Value', unresolved),
    };
  });

  // 3. Resolve Headers (for enabled rows)
  cloned.headers = cloned.headers.map((header) => {
    if (!header.enabled) return header;
    return {
      ...header,
      key: substituteText(header.key, varMap, 'Header Key', unresolved),
      value: substituteText(header.value, varMap, 'Header Value', unresolved),
    };
  });

  // 4. Resolve Body
  if (cloned.bodyType === 'json' || cloned.bodyType === 'text') {
    cloned.body = substituteText(cloned.body, varMap, 'Body', unresolved);
  } else if (cloned.bodyType === 'x-www-form-urlencoded' && Array.isArray(cloned.formUrlEncoded)) {
    cloned.formUrlEncoded = cloned.formUrlEncoded.map((field) => {
      if (!field.enabled) return field;
      return {
        ...field,
        key: substituteText(field.key, varMap, 'Form URL Encoded Key', unresolved),
        value: substituteText(field.value, varMap, 'Form URL Encoded Value', unresolved),
      };
    });
  } else if (cloned.bodyType === 'multipart/form-data' && Array.isArray(cloned.multipartFormData)) {
    cloned.multipartFormData = cloned.multipartFormData.map((field) => {
      if (!field.enabled) return field;
      return {
        ...field,
        key: substituteText(field.key, varMap, 'Multipart Field Key', unresolved),
        value: substituteText(field.value, varMap, 'Multipart Field Value', unresolved),
      };
    });
  }

  // 5. Resolve Authentication
  if (cloned.auth?.type === 'bearer' && cloned.auth.bearer) {
    cloned.auth.bearer.token = substituteText(
      cloned.auth.bearer.token,
      varMap,
      'Bearer Token',
      unresolved
    );
  } else if (cloned.auth?.type === 'apiKey' && cloned.auth.apiKey) {
    cloned.auth.apiKey.key = substituteText(
      cloned.auth.apiKey.key,
      varMap,
      'API Key Name',
      unresolved
    );
    cloned.auth.apiKey.value = substituteText(
      cloned.auth.apiKey.value,
      varMap,
      'API Key Value',
      unresolved
    );
  }

  // Deduplicate unresolved list for clean error reporting
  const uniqueUnresolved: UnresolvedVariable[] = [];
  const seen = new Set<string>();
  for (const item of unresolved) {
    const key = `${item.name}:${item.location}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueUnresolved.push(item);
    }
  }

  return {
    resolvedRequest: cloned,
    unresolved: uniqueUnresolved,
    isValid: uniqueUnresolved.length === 0,
  };
}
