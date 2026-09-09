import type { Collection } from '../types/collection';

const COLLECTIONS_STORAGE_KEY = 'apiforge_collections';

/**
 * Safely loads and parses collections from browser localStorage.
 * Returns an empty array if no collections exist or parsing fails.
 */
export function loadCollectionsFromStorage(): Collection[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Failed to load collections from localStorage:', err);
    return [];
  }
}

/**
 * Safely serializes and persists collections to browser localStorage.
 */
export function saveCollectionsToStorage(collections: Collection[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  } catch (err) {
    console.error('Failed to save collections to localStorage:', err);
  }
}

/**
 * Clears all collections from browser localStorage.
 */
export function clearCollectionsFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(COLLECTIONS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear collections from localStorage:', err);
  }
}
