/**
 * Frontend Configuration Utility
 * Centralizes environment configuration and backend URL resolution.
 */

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

/**
 * Returns the normalized backend base URL without trailing slashes.
 */
export function getBackendUrl(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  const envUrl = env?.VITE_BACKEND_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_BACKEND_URL;
}

/**
 * Constructs a safe full API URL for a given backend route path.
 * E.g. getApiUrl('/api/request/execute') -> 'http://localhost:3001/api/request/execute'
 */
export function getApiUrl(path: string): string {
  const base = getBackendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
