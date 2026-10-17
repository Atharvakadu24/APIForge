/**
 * Frontend Configuration Utility
 * Centralizes environment configuration and backend URL resolution.
 */

const PRODUCTION_BACKEND_URL = 'https://apiforge-backend-9t9a.onrender.com';
const LOCAL_BACKEND_URL = 'http://localhost:3001';

/**
 * Returns the normalized backend base URL without trailing slashes.
 * Respects explicit VITE_BACKEND_URL if set; otherwise falls back to
 * the deployed Render backend in production and http://localhost:3001 in development.
 */
export function getBackendUrl(): string {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : undefined;
  const envUrl = env?.VITE_BACKEND_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return env?.PROD ? PRODUCTION_BACKEND_URL : LOCAL_BACKEND_URL;
}

/**
 * Constructs a safe full API URL for a given backend route path.
 * E.g. getApiUrl('/api/request/execute') -> 'https://apiforge-backend-9t9a.onrender.com/api/request/execute' (in production)
 *                                         'http://localhost:3001/api/request/execute' (in development)
 */
export function getApiUrl(path: string): string {
  const base = getBackendUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
