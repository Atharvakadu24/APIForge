import type { HistoryItem } from '../types/history';
import type { ApiRequest } from '../types/request';

const STORAGE_KEY = 'apiforge_request_history';
export const MAX_HISTORY_ITEMS = 50;

/**
 * Creates a deep copy of an ApiRequest to prevent shared reference mutations.
 */
export function cloneRequest(req: ApiRequest): ApiRequest {
  return {
    method: req.method,
    url: req.url,
    queryParams: Array.isArray(req.queryParams)
      ? req.queryParams.map((item) => ({ ...item }))
      : [],
    headers: Array.isArray(req.headers)
      ? req.headers.map((item) => ({ ...item }))
      : [],
    bodyType: req.bodyType || 'none',
    body: req.body || '',
    formUrlEncoded: Array.isArray(req.formUrlEncoded)
      ? req.formUrlEncoded.map((item) => ({ ...item }))
      : [],
    multipartFormData: Array.isArray(req.multipartFormData)
      ? req.multipartFormData.map((item) => ({ ...item }))
      : [],
    auth: {
      type: req.auth?.type || 'none',
      bearer: req.auth?.bearer ? { ...req.auth.bearer } : undefined,
      apiKey: req.auth?.apiKey ? { ...req.auth.apiKey } : undefined,
    },
  };
}

/**
 * Loads and validates request history from browser localStorage.
 */
export function loadHistoryFromStorage(): HistoryItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Failed to load request history from localStorage:', err);
    return [];
  }
}

/**
 * Persists request history to browser localStorage with FIFO truncation.
 */
export function saveHistoryToStorage(items: HistoryItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const trimmed = items.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to save request history to localStorage:', err);
  }
}

/**
 * Clears request history from browser localStorage.
 */
export function clearHistoryFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear request history from localStorage:', err);
  }
}
