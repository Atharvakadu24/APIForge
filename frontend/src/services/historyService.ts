import { supabase } from '../lib/supabase';
import type { HistoryItem, DatabaseHistoryRow } from '../types/history';
import type { HttpMethod } from '../types/request';
import {
  loadHistoryFromStorage,
  clearHistoryFromStorage,
  MAX_HISTORY_ITEMS,
} from '../utils/historyStorage';

const LEGACY_HISTORY_BACKUP_STORAGE_KEY = 'apiforge_history_legacy_backup';
const MIGRATION_FLAG_PREFIX = 'apiforge_history_migrated_';

/**
 * Validates or generates a valid UUID v4 to avoid PostgreSQL UUID cast errors.
 */
export function ensureValidUuid(id?: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (id && uuidRegex.test(id)) {
    return id;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Maps a database snake_case row to the camelCase HistoryItem interface.
 */
function mapRowToHistoryItem(row: DatabaseHistoryRow): HistoryItem {
  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    method: (row.method as HttpMethod) || 'GET',
    url: row.url || '',
    status: row.status,
    statusText: row.status_text || '',
    latency: row.latency || 0,
    size: row.size || 0,
    isError: !!row.is_error,
    request: row.request,
    response: row.response || null,
  };
}

/**
 * Retrieves the currently authenticated user ID from Supabase Auth session.
 */
async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('User is not authenticated.');
  }
  return data.user.id;
}

/**
 * Fetches the request history for the authenticated user, ordered from newest to oldest.
 * Capped at 50 items.
 */
export async function getHistory(): Promise<{
  data: HistoryItem[] | null;
  error: Error | null;
}> {
  try {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('request_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_ITEMS);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const historyItems = (data as DatabaseHistoryRow[]).map(mapRowToHistoryItem);
    return { data: historyItems, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch request history';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Persists a new history item to Supabase and enforces the 50-item FIFO retention policy.
 */
export async function addHistoryItem(
  item: Omit<HistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<{ data: HistoryItem | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const newId = ensureValidUuid(item.id);
    const createdAt = new Date(item.timestamp || Date.now()).toISOString();

    const { data, error } = await supabase
      .from('request_history')
      .insert({
        id: newId,
        user_id: userId,
        method: item.method,
        url: item.url,
        status: item.status,
        status_text: item.statusText || '',
        latency: item.latency || 0,
        size: item.size || 0,
        is_error: !!item.isError,
        request: item.request,
        response: item.response || null,
        created_at: createdAt,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Enforce 50-item FIFO retention: purge older items beyond the 50 newest
    try {
      const { data: excessRows } = await supabase
        .from('request_history')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(MAX_HISTORY_ITEMS, MAX_HISTORY_ITEMS + 50);

      if (excessRows && excessRows.length > 0) {
        const excessIds = excessRows.map((r: { id: string }) => r.id);
        await supabase
          .from('request_history')
          .delete()
          .in('id', excessIds)
          .eq('user_id', userId);
      }
    } catch (cleanupErr) {
      console.warn('[APIForge History] Background FIFO cleanup warning:', cleanupErr);
    }

    const created = mapRowToHistoryItem(data as DatabaseHistoryRow);
    return { data: created, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add history item';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Deletes a single history item for the authenticated user.
 */
export async function deleteHistoryItem(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const { error } = await supabase
      .from('request_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete history item';
    return { error: new Error(msg) };
  }
}

/**
 * Clears all history items for the authenticated user.
 */
export async function clearHistory(): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const { error } = await supabase
      .from('request_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to clear history';
    return { error: new Error(msg) };
  }
}

/**
 * Safely migrates and reconciles legacy localStorage history with Supabase:
 * - Scans localStorage for legacy history items.
 * - If no local history exists, marks the migration flag and returns cloud history.
 * - If local history exists:
 *   - For each local item, checks if it already exists in the cloud (by ID or timestamp+method+url).
 *   - If not in cloud, creates the history entry in Supabase.
 *   - Guarantees NO duplicate history items are created.
 *   - Guarantees NO local data is discarded if cloud already has different or partial data.
 *   - Only on complete success: backs up legacy data and clears active localStorage history.
 *   - On any failure: keeps localStorage untouched so no data is ever lost.
 */
export async function syncOrMigrateLegacyHistory(
  currentUserId: string,
  cloudHistory: HistoryItem[]
): Promise<{
  didMigrate: boolean;
  migratedCount: number;
  history: HistoryItem[];
  error: Error | null;
}> {
  const migrationFlagKey = `${MIGRATION_FLAG_PREFIX}${currentUserId}`;

  // 1. Check if legacy history exists in localStorage
  const legacyItems = loadHistoryFromStorage();
  if (!Array.isArray(legacyItems) || legacyItems.length === 0) {
    try {
      localStorage.setItem(migrationFlagKey, Date.now().toString());
    } catch {
      // ignore storage quota issues
    }
    return {
      didMigrate: false,
      migratedCount: 0,
      history: cloudHistory,
      error: null,
    };
  }

  console.log(
    `[APIForge Migration] Inspecting ${legacyItems.length} legacy local history item(s) against ${cloudHistory.length} cloud history item(s)...`
  );

  let migratedCount = 0;

  try {
    const workingCloudHistory = [...cloudHistory];

    for (const localItem of legacyItems) {
      // Match by ID or by matching timestamp, method, url, status
      const existingInCloud = workingCloudHistory.find(
        (h) =>
          (localItem.id && h.id === localItem.id) ||
          (h.timestamp === localItem.timestamp &&
            h.method === localItem.method &&
            h.url === localItem.url &&
            h.status === localItem.status)
      );

      if (!existingInCloud) {
        const newId = ensureValidUuid(localItem.id);
        const createdAt = new Date(localItem.timestamp || Date.now()).toISOString();

        const { data: insertedRow, error: insertErr } = await supabase
          .from('request_history')
          .insert({
            id: newId,
            user_id: currentUserId,
            method: localItem.method,
            url: localItem.url,
            status: localItem.status,
            status_text: localItem.statusText || '',
            latency: localItem.latency || 0,
            size: localItem.size || 0,
            is_error: !!localItem.isError,
            request: localItem.request,
            response: localItem.response || null,
            created_at: createdAt,
          })
          .select()
          .single();

        if (insertErr || !insertedRow) {
          throw new Error(
            `Failed to migrate history item for "${localItem.url}": ${
              insertErr?.message || 'Unknown database error'
            }`
          );
        }

        const mapped = mapRowToHistoryItem(insertedRow as DatabaseHistoryRow);
        workingCloudHistory.push(mapped);
        migratedCount++;
      }
    }

    // 100% SUCCESS: Backup to legacy backup, clear active localStorage history, and set migration flag
    try {
      const existingBackupRaw = localStorage.getItem(LEGACY_HISTORY_BACKUP_STORAGE_KEY);
      let backupList: HistoryItem[] = [];
      if (existingBackupRaw) {
        try {
          const parsed = JSON.parse(existingBackupRaw);
          if (Array.isArray(parsed)) backupList = parsed;
        } catch {
          // ignore
        }
      }

      const backupMap = new Map<string, HistoryItem>();
      for (const item of backupList) {
        backupMap.set(item.id || `${item.timestamp}-${item.url}`, item);
      }
      for (const item of legacyItems) {
        backupMap.set(item.id || `${item.timestamp}-${item.url}`, item);
      }

      localStorage.setItem(
        LEGACY_HISTORY_BACKUP_STORAGE_KEY,
        JSON.stringify(Array.from(backupMap.values()))
      );
      clearHistoryFromStorage();
      localStorage.setItem(migrationFlagKey, Date.now().toString());
    } catch (storageErr) {
      console.warn('[APIForge Migration] Could not backup legacy history:', storageErr);
    }

    if (migratedCount > 0) {
      console.log(
        `[APIForge Migration] Successfully reconciled ${migratedCount} history item(s) to Supabase.`
      );
    } else {
      console.log(
        '[APIForge Migration] All local history items were already present in Supabase. Cleaned up local storage.'
      );
    }

    // Reload latest ordered cloud history from Supabase
    const { data: freshCloud } = await getHistory();
    return {
      didMigrate: migratedCount > 0,
      migratedCount,
      history: freshCloud || workingCloudHistory.slice(0, MAX_HISTORY_ITEMS),
      error: null,
    };
  } catch (migrationErr: unknown) {
    const error = migrationErr instanceof Error ? migrationErr : new Error('History migration failed');
    console.error('[APIForge Migration] Error during legacy history migration/reconciliation:', error);
    return {
      didMigrate: false,
      migratedCount: 0,
      history: cloudHistory,
      error,
    };
  }
}
