import type { Environment } from '../types/environment';

const ENVIRONMENTS_STORAGE_KEY = 'apiforge_environments';
const ACTIVE_ENV_STORAGE_KEY = 'apiforge_active_environment_id';

/**
 * Safely loads environments from browser localStorage.
 * Returns an empty array if no environments exist or parsing fails.
 */
export function loadEnvironmentsFromStorage(): Environment[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(ENVIRONMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Failed to load environments from localStorage:', err);
    return [];
  }
}

/**
 * Safely saves environments to browser localStorage.
 */
export function saveEnvironmentsToStorage(environments: Environment[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(ENVIRONMENTS_STORAGE_KEY, JSON.stringify(environments));
  } catch (err) {
    console.error('Failed to save environments to localStorage:', err);
  }
}

/**
 * Loads and validates the active environment ID from localStorage.
 * If the stored ID no longer exists in the given environments list, returns null.
 */
export function loadActiveEnvironmentId(environments: Environment[]): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const storedId = localStorage.getItem(ACTIVE_ENV_STORAGE_KEY);
    if (!storedId) return null;
    
    const exists = environments.some((env) => env.id === storedId);
    if (!exists) {
      localStorage.removeItem(ACTIVE_ENV_STORAGE_KEY);
      return null;
    }
    return storedId;
  } catch (err) {
    console.error('Failed to load active environment ID:', err);
    return null;
  }
}

/**
 * Persists the active environment ID to localStorage.
 */
export function saveActiveEnvironmentId(id: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (id) {
      localStorage.setItem(ACTIVE_ENV_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ENV_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to save active environment ID:', err);
  }
}

/**
 * Clears all environments from browser localStorage.
 */
export function clearEnvironmentsFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(ENVIRONMENTS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear environments from localStorage:', err);
  }
}


