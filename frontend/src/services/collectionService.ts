import { supabase } from '../lib/supabase';
import type { Collection, SavedRequest } from '../types/collection';
import type { ApiRequest } from '../types/request';
import {
  loadCollectionsFromStorage,
  clearCollectionsFromStorage,
} from '../utils/collectionStorage';

export interface DatabaseCollectionRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  saved_requests?: DatabaseSavedRequestRow[];
}

export interface DatabaseSavedRequestRow {
  id: string;
  collection_id: string;
  user_id: string;
  name: string;
  request: ApiRequest;
  created_at: string;
  updated_at: string;
}

const LEGACY_BACKUP_STORAGE_KEY = 'apiforge_collections_legacy_backup';
const MIGRATION_FLAG_PREFIX = 'apiforge_collections_migrated_';

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
  // Fallback UUID v4 generator if crypto.randomUUID is unavailable
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapRowToSavedRequest(row: DatabaseSavedRequestRow): SavedRequest {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    request: row.request,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapRowToCollection(row: DatabaseCollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    requests: Array.isArray(row.saved_requests)
      ? row.saved_requests
          .map(mapRowToSavedRequest)
          .sort((a, b) => a.createdAt - b.createdAt)
      : [],
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
 * Fetches all collections with their nested saved requests for the current user.
 */
export async function getCollections(): Promise<{
  data: Collection[] | null;
  error: Error | null;
}> {
  try {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('collections')
      .select('*, saved_requests(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const collections = (data as DatabaseCollectionRow[]).map(mapRowToCollection);
    return { data: collections, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch collections';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Creates a new collection in Supabase for the authenticated user.
 */
export async function createCollection(
  name: string
): Promise<{ data: Collection | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const newId = ensureValidUuid();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('collections')
      .insert({
        id: newId,
        user_id: userId,
        name: name.trim(),
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const created = mapRowToCollection(data as DatabaseCollectionRow);
    return { data: created, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create collection';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Renames an existing collection in Supabase.
 */
export async function renameCollection(
  id: string,
  newName: string
): Promise<{ data: Collection | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('collections')
      .update({
        name: newName.trim(),
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, saved_requests(*)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const updated = mapRowToCollection(data as DatabaseCollectionRow);
    return { data: updated, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename collection';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Deletes a collection (and its associated saved requests) in Supabase.
 */
export async function deleteCollection(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    // First delete nested saved requests explicitly (in case CASCADE is not configured)
    await supabase
      .from('saved_requests')
      .delete()
      .eq('collection_id', id)
      .eq('user_id', userId);

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete collection';
    return { error: new Error(msg) };
  }
}

/**
 * Creates and persists a new saved request inside a collection.
 */
export async function createSavedRequest(
  collectionId: string,
  name: string,
  request: ApiRequest
): Promise<{ data: SavedRequest | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const newId = ensureValidUuid();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('saved_requests')
      .insert({
        id: newId,
        collection_id: collectionId,
        user_id: userId,
        name: name.trim(),
        request: request,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const saved = mapRowToSavedRequest(data as DatabaseSavedRequestRow);
    return { data: saved, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save request';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Updates an existing saved request's configuration and/or name.
 */
export async function updateSavedRequest(
  id: string,
  request: ApiRequest,
  name?: string
): Promise<{ data: SavedRequest | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      request: request,
      updated_at: now,
    };

    if (name && name.trim()) {
      updatePayload.name = name.trim();
    }

    const { data, error } = await supabase
      .from('saved_requests')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const updated = mapRowToSavedRequest(data as DatabaseSavedRequestRow);
    return { data: updated, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update saved request';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Deletes a single saved request from Supabase.
 */
export async function deleteSavedRequest(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const { error } = await supabase
      .from('saved_requests')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete saved request';
    return { error: new Error(msg) };
  }
}

/**
 * Safely migrates and reconciles legacy localStorage collections with Supabase:
 * - Scans localStorage for legacy collections.
 * - If no local collections exist, marks the migration flag and returns cloud collections.
 * - If local collections exist:
 *   - For each local collection, checks if it already exists in the cloud (by ID or name).
 *   - If not in cloud, creates the collection in Supabase.
 *   - For each saved request in the local collection, checks if it already exists in the matching cloud collection.
 *   - If not in cloud, creates the saved request in Supabase.
 *   - Guarantees NO duplicate collections or requests are created.
 *   - Guarantees NO local data is discarded if cloud already has different or partial data.
 *   - Only on complete success: backs up legacy data to localStorage backup and clears active localStorage collections.
 *   - On any failure: keeps localStorage untouched so no data is ever lost.
 */
export async function syncOrMigrateLegacyCollections(
  currentUserId: string,
  cloudCollections: Collection[]
): Promise<{
  didMigrate: boolean;
  migratedCount: number;
  collections: Collection[];
  error: Error | null;
}> {
  const migrationFlagKey = `${MIGRATION_FLAG_PREFIX}${currentUserId}`;

  // 1. Check if legacy collections exist in localStorage
  const legacyCollections = loadCollectionsFromStorage();
  if (!Array.isArray(legacyCollections) || legacyCollections.length === 0) {
    try {
      localStorage.setItem(migrationFlagKey, Date.now().toString());
    } catch {
      // ignore storage quota issues
    }
    return {
      didMigrate: false,
      migratedCount: 0,
      collections: cloudCollections,
      error: null,
    };
  }

  console.log(
    `[APIForge Migration] Inspecting ${legacyCollections.length} legacy local collection(s) against ${cloudCollections.length} cloud collection(s)...`
  );

  let migratedCollectionsCount = 0;
  let migratedRequestsCount = 0;

  try {
    // Maintain a mutable copy of cloud collections for matching during this migration pass
    const workingCloudCollections = [...cloudCollections];

    for (const localCol of legacyCollections) {
      const colName = (localCol.name || 'Untitled Collection').trim();
      const localRequests = Array.isArray(localCol.requests) ? localCol.requests : [];

      // Check if collection already exists in Supabase (by ID or by case-insensitive name)
      let targetCloudCol = workingCloudCollections.find(
        (c) =>
          (localCol.id && c.id === localCol.id) ||
          c.name.trim().toLowerCase() === colName.toLowerCase()
      );

      let targetCollectionId: string;

      if (!targetCloudCol) {
        // Collection does not exist in cloud -> create it
        const newColId = ensureValidUuid(localCol.id);
        const colCreatedAt = new Date(localCol.createdAt || Date.now()).toISOString();
        const colUpdatedAt = new Date(localCol.updatedAt || Date.now()).toISOString();

        const { data: insertedCol, error: colErr } = await supabase
          .from('collections')
          .insert({
            id: newColId,
            user_id: currentUserId,
            name: colName,
            created_at: colCreatedAt,
            updated_at: colUpdatedAt,
          })
          .select('*, saved_requests(*)')
          .single();

        if (colErr || !insertedCol) {
          throw new Error(
            `Failed to create cloud collection "${colName}": ${colErr?.message || 'Unknown database error'}`
          );
        }

        const mappedCol = mapRowToCollection(insertedCol as DatabaseCollectionRow);
        workingCloudCollections.push(mappedCol);
        targetCloudCol = mappedCol;
        targetCollectionId = mappedCol.id;
        migratedCollectionsCount++;
      } else {
        // Collection already exists in cloud -> use existing cloud collection ID
        targetCollectionId = targetCloudCol.id;
      }

      // Reconcile nested saved requests
      for (const localReq of localRequests) {
        const reqName = (localReq.name || 'Untitled Request').trim();
        const safeRequest: ApiRequest = {
          method: localReq.request?.method || 'GET',
          url: localReq.request?.url || '',
          queryParams: Array.isArray(localReq.request?.queryParams) ? localReq.request.queryParams : [],
          headers: Array.isArray(localReq.request?.headers) ? localReq.request.headers : [],
          bodyType: localReq.request?.bodyType || 'none',
          body: typeof localReq.request?.body === 'string' ? localReq.request.body : '',
          auth: localReq.request?.auth || { type: 'none' },
        };

        // Check if request already exists in target cloud collection
        const existingReqInCloud = targetCloudCol.requests.find(
          (r) =>
            (localReq.id && r.id === localReq.id) ||
            (r.name.trim().toLowerCase() === reqName.toLowerCase() &&
              r.request.method === safeRequest.method &&
              r.request.url === safeRequest.url)
        );

        if (!existingReqInCloud) {
          // Request missing in cloud -> insert it
          const newReqId = ensureValidUuid(localReq.id);
          const reqCreatedAt = new Date(localReq.createdAt || Date.now()).toISOString();
          const reqUpdatedAt = new Date(localReq.updatedAt || Date.now()).toISOString();

          const { data: insertedReq, error: reqErr } = await supabase
            .from('saved_requests')
            .insert({
              id: newReqId,
              collection_id: targetCollectionId,
              user_id: currentUserId,
              name: reqName,
              request: safeRequest,
              created_at: reqCreatedAt,
              updated_at: reqUpdatedAt,
            })
            .select()
            .single();

          if (reqErr || !insertedReq) {
            throw new Error(
              `Failed to migrate saved request "${reqName}" into collection "${colName}": ${
                reqErr?.message || 'Unknown database error'
              }`
            );
          }

          const mappedReq = mapRowToSavedRequest(insertedReq as DatabaseSavedRequestRow);
          targetCloudCol.requests.push(mappedReq);
          migratedRequestsCount++;
        }
      }
    }

    // 100% SUCCESS: Merge into legacy backup, clear active localStorage collections, and set migration flag
    try {
      const existingBackupRaw = localStorage.getItem(LEGACY_BACKUP_STORAGE_KEY);
      let backupList: Collection[] = [];
      if (existingBackupRaw) {
        try {
          const parsed = JSON.parse(existingBackupRaw);
          if (Array.isArray(parsed)) backupList = parsed;
        } catch {
          // ignore
        }
      }

      const backupMap = new Map<string, Collection>();
      for (const item of backupList) {
        backupMap.set(item.id || item.name, item);
      }
      for (const item of legacyCollections) {
        backupMap.set(item.id || item.name, item);
      }

      localStorage.setItem(LEGACY_BACKUP_STORAGE_KEY, JSON.stringify(Array.from(backupMap.values())));
      clearCollectionsFromStorage();
      localStorage.setItem(migrationFlagKey, Date.now().toString());
    } catch (storageErr) {
      console.warn('[APIForge Migration] Could not backup legacy collections:', storageErr);
    }

    const totalMigrated = migratedCollectionsCount + migratedRequestsCount;
    if (totalMigrated > 0) {
      console.log(
        `[APIForge Migration] Successfully reconciled ${migratedCollectionsCount} collection(s) and ${migratedRequestsCount} saved request(s) to Supabase.`
      );
    } else {
      console.log(
        '[APIForge Migration] All local collections and requests were already present in Supabase. Cleaned up local storage.'
      );
    }

    // Reload latest cloud collections from Supabase
    const { data: freshCloud } = await getCollections();
    return {
      didMigrate: totalMigrated > 0,
      migratedCount: totalMigrated,
      collections: freshCloud || workingCloudCollections,
      error: null,
    };
  } catch (migrationErr: unknown) {
    const error = migrationErr instanceof Error ? migrationErr : new Error('Migration failed');
    console.error('[APIForge Migration] Error during legacy migration/reconciliation:', error);
    // On failure: do NOT clear localStorage collections and do NOT set migration flag
    return {
      didMigrate: false,
      migratedCount: 0,
      collections: cloudCollections,
      error,
    };
  }
}
