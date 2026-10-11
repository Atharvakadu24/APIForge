import { supabase } from '../lib/supabase';
import type { Collection, CollectionFolder, SavedRequest } from '../types/collection';
import type { ApiRequest } from '../types/request';
import {
  loadCollectionsFromStorage,
  clearCollectionsFromStorage,
} from '../utils/collectionStorage';

export interface DatabaseCollectionRow {
  id: string;
  user_id: string;
  name: string;
  order_index?: number;
  created_at: string;
  updated_at: string;
  collection_folders?: DatabaseFolderRow[];
  saved_requests?: DatabaseSavedRequestRow[];
}

export interface DatabaseFolderRow {
  id: string;
  collection_id: string;
  parent_folder_id: string | null;
  user_id: string;
  name: string;
  order_index?: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSavedRequestRow {
  id: string;
  collection_id: string;
  folder_id: string | null;
  user_id: string;
  name: string;
  request: ApiRequest;
  order_index?: number;
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

/**
 * Maps a database saved_requests row to frontend SavedRequest.
 */
export function mapRowToSavedRequest(row: DatabaseSavedRequestRow): SavedRequest {
  return {
    id: row.id,
    collectionId: row.collection_id,
    folderId: row.folder_id || null,
    name: row.name,
    request: row.request,
    orderIndex: typeof row.order_index === 'number' ? row.order_index : 0,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/**
 * Recursively builds the folder tree for a given parent folder ID (or null for root collection folders).
 */
function buildFolderTree(
  parentFolderId: string | null,
  allFolderRows: DatabaseFolderRow[],
  allRequestRows: DatabaseSavedRequestRow[]
): CollectionFolder[] {
  const matchingFolders = allFolderRows.filter((f) =>
    parentFolderId === null ? !f.parent_folder_id : f.parent_folder_id === parentFolderId
  );

  // Sort folders deterministically by order_index ASC, then created_at ASC
  matchingFolders.sort((a, b) => {
    const orderDiff = (a.order_index ?? 0) - (b.order_index ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return matchingFolders.map((fRow) => {
    // Get direct requests inside this folder
    const folderRequests = allRequestRows
      .filter((r) => r.folder_id === fRow.id)
      .map(mapRowToSavedRequest)
      .sort((a, b) => {
        const orderDiff = a.orderIndex - b.orderIndex;
        if (orderDiff !== 0) return orderDiff;
        return a.createdAt - b.createdAt;
      });

    // Recursively build subfolders (supports arbitrary depth)
    const subfolders = buildFolderTree(fRow.id, allFolderRows, allRequestRows);

    return {
      id: fRow.id,
      collectionId: fRow.collection_id,
      parentFolderId: fRow.parent_folder_id || null,
      name: fRow.name,
      orderIndex: typeof fRow.order_index === 'number' ? fRow.order_index : 0,
      createdAt: new Date(fRow.created_at).getTime(),
      updatedAt: new Date(fRow.updated_at).getTime(),
      subfolders,
      requests: folderRequests,
    };
  });
}

/**
 * Maps a database collections row to frontend Collection with full recursive folders and root requests.
 */
export function mapRowToCollection(row: DatabaseCollectionRow): Collection {
  const allFolderRows: DatabaseFolderRow[] = Array.isArray(row.collection_folders)
    ? row.collection_folders
    : [];
  const allRequestRows: DatabaseSavedRequestRow[] = Array.isArray(row.saved_requests)
    ? row.saved_requests
    : [];

  // Root requests: requests where folder_id is null or doesn't match an existing folder in collection
  const rootRequests = allRequestRows
    .filter((r) => !r.folder_id)
    .map(mapRowToSavedRequest)
    .sort((a, b) => {
      const orderDiff = a.orderIndex - b.orderIndex;
      if (orderDiff !== 0) return orderDiff;
      return a.createdAt - b.createdAt;
    });

  // Top-level folders (parent_folder_id is null)
  const folders = buildFolderTree(null, allFolderRows, allRequestRows);

  return {
    id: row.id,
    name: row.name,
    orderIndex: typeof row.order_index === 'number' ? row.order_index : 0,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    folders,
    requests: rootRequests,
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
 * Fetches all collections with their nested folders and saved requests for the current user.
 * Surfaces an explicit error if the required database schema is missing.
 */
export async function getCollections(): Promise<{
  data: Collection[] | null;
  error: Error | null;
  isMigrationRequired?: boolean;
}> {
  try {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_folders(*), saved_requests(*)')
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      const isSchemaError =
        error.message.includes('collection_folders') ||
        error.message.includes('order_index') ||
        error.message.includes('folder_id') ||
        error.code === '42P01' || // relation does not exist
        error.code === '42703'; // column does not exist

      return {
        data: null,
        error: new Error(
          isSchemaError
            ? `Database Schema Migration Required for Milestone 8: ${error.message}`
            : error.message
        ),
        isMigrationRequired: isSchemaError,
      };
    }

    const collections = (data as DatabaseCollectionRow[])
      .map(mapRowToCollection)
      .sort((a, b) => {
        const orderDiff = a.orderIndex - b.orderIndex;
        if (orderDiff !== 0) return orderDiff;
        return a.createdAt - b.createdAt;
      });

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
  name: string,
  orderIndex: number = 0
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
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
      })
      .select('*, collection_folders(*), saved_requests(*)')
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
      .select('*, collection_folders(*), saved_requests(*)')
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
 * Deletes a collection (and all its subfolders and saved requests via CASCADE) in Supabase.
 */
export async function deleteCollection(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

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
 * Updates the order index for a set of collections.
 */
export async function reorderCollections(
  orderedCollectionIds: string[]
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const updates = orderedCollectionIds.map((id, index) =>
      supabase
        .from('collections')
        .update({ order_index: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed && failed.error) {
      return { error: new Error(failed.error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reorder collections';
    return { error: new Error(msg) };
  }
}

/**
 * Creates a new folder inside a collection (or subfolder under parentFolderId).
 */
export async function createFolder(
  collectionId: string,
  name: string,
  parentFolderId: string | null = null,
  orderIndex: number = 0
): Promise<{ data: CollectionFolder | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const newId = ensureValidUuid();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('collection_folders')
      .insert({
        id: newId,
        collection_id: collectionId,
        parent_folder_id: parentFolderId || null,
        user_id: userId,
        name: name.trim(),
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const row = data as DatabaseFolderRow;
    const folder: CollectionFolder = {
      id: row.id,
      collectionId: row.collection_id,
      parentFolderId: row.parent_folder_id || null,
      name: row.name,
      orderIndex: typeof row.order_index === 'number' ? row.order_index : 0,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      subfolders: [],
      requests: [],
    };

    return { data: folder, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create folder';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Renames an existing folder.
 */
export async function renameFolder(
  folderId: string,
  newName: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('collection_folders')
      .update({
        name: newName.trim(),
        updated_at: now,
      })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename folder';
    return { error: new Error(msg) };
  }
}

/**
 * Deletes a folder (and cascades to all subfolders and saved requests in Supabase).
 */
export async function deleteFolder(
  folderId: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const { error } = await supabase
      .from('collection_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete folder';
    return { error: new Error(msg) };
  }
}

/**
 * Helper to collect all descendant folder IDs of a given folder.
 */
export function getAllDescendantFolderIds(folder: CollectionFolder): string[] {
  const ids: string[] = [];
  if (Array.isArray(folder.subfolders)) {
    for (const sub of folder.subfolders) {
      ids.push(sub.id);
      ids.push(...getAllDescendantFolderIds(sub));
    }
  }
  return ids;
}

/**
 * Helper to find a folder by ID inside a collection hierarchy.
 */
export function findFolderInCollection(
  folders: CollectionFolder[],
  folderId: string
): CollectionFolder | null {
  for (const f of folders) {
    if (f.id === folderId) return f;
    if (f.subfolders && f.subfolders.length > 0) {
      const found = findFolderInCollection(f.subfolders, folderId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Moves a folder to a new parent within the SAME collection.
 * Strictly validates against circular parent references.
 */
export async function moveFolder(
  folderId: string,
  targetParentFolderId: string | null,
  collectionFolders: CollectionFolder[]
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    // 1. Validate circular reference
    if (targetParentFolderId === folderId) {
      return {
        error: new Error('Cannot move a folder into itself.'),
      };
    }

    if (targetParentFolderId !== null) {
      const sourceFolder = findFolderInCollection(collectionFolders, folderId);
      if (sourceFolder) {
        const descendantIds = getAllDescendantFolderIds(sourceFolder);
        if (descendantIds.includes(targetParentFolderId)) {
          return {
            error: new Error('Cannot move a folder into one of its subfolders.'),
          };
        }
      }
    }

    // 2. Perform update in Supabase
    const { error } = await supabase
      .from('collection_folders')
      .update({
        parent_folder_id: targetParentFolderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to move folder';
    return { error: new Error(msg) };
  }
}

/**
 * Reorders a list of sibling folders under the same collection & parentFolderId.
 */
export async function reorderFolders(
  orderedFolderIds: string[]
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const updates = orderedFolderIds.map((id, index) =>
      supabase
        .from('collection_folders')
        .update({ order_index: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed && failed.error) {
      return { error: new Error(failed.error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reorder folders';
    return { error: new Error(msg) };
  }
}

/**
 * Creates and persists a new saved request inside a collection (optionally inside a folder).
 */
export async function createSavedRequest(
  collectionId: string,
  name: string,
  request: ApiRequest,
  folderId: string | null = null,
  orderIndex: number = 0
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
        folder_id: folderId || null,
        user_id: userId,
        name: name.trim(),
        request: request,
        order_index: orderIndex,
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
 * Moves a saved request to another collection and/or folder.
 */
export async function moveSavedRequest(
  requestId: string,
  targetCollectionId: string,
  targetFolderId: string | null = null,
  orderIndex: number = 0
): Promise<{ data: SavedRequest | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('saved_requests')
      .update({
        collection_id: targetCollectionId,
        folder_id: targetFolderId || null,
        order_index: orderIndex,
        updated_at: now,
      })
      .eq('id', requestId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const updated = mapRowToSavedRequest(data as DatabaseSavedRequestRow);
    return { data: updated, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to move request';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Reorders a list of sibling saved requests within the same folder or collection root.
 */
export async function reorderRequests(
  orderedRequestIds: string[]
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const updates = orderedRequestIds.map((id, index) =>
      supabase
        .from('saved_requests')
        .update({ order_index: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed && failed.error) {
      return { error: new Error(failed.error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reorder requests';
    return { error: new Error(msg) };
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
 * Safely migrates and reconciles legacy localStorage collections with Supabase.
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
    const workingCloudCollections = [...cloudCollections];

    for (const [colIdx, localCol] of legacyCollections.entries()) {
      const colName = (localCol.name || 'Untitled Collection').trim();
      const localRequests = Array.isArray(localCol.requests) ? localCol.requests : [];

      let targetCloudCol = workingCloudCollections.find(
        (c) =>
          (localCol.id && c.id === localCol.id) ||
          c.name.trim().toLowerCase() === colName.toLowerCase()
      );

      let targetCollectionId: string;

      if (!targetCloudCol) {
        const newColId = ensureValidUuid(localCol.id);
        const colCreatedAt = new Date(localCol.createdAt || Date.now()).toISOString();
        const colUpdatedAt = new Date(localCol.updatedAt || Date.now()).toISOString();

        const { data: insertedCol, error: colErr } = await supabase
          .from('collections')
          .insert({
            id: newColId,
            user_id: currentUserId,
            name: colName,
            order_index: typeof localCol.orderIndex === 'number' ? localCol.orderIndex : colIdx,
            created_at: colCreatedAt,
            updated_at: colUpdatedAt,
          })
          .select('*, collection_folders(*), saved_requests(*)')
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
        targetCollectionId = targetCloudCol.id;
      }

      // Reconcile root saved requests
      for (const [reqIdx, localReq] of localRequests.entries()) {
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

        const existingReqInCloud = targetCloudCol.requests.find(
          (r) =>
            (localReq.id && r.id === localReq.id) ||
            (r.name.trim().toLowerCase() === reqName.toLowerCase() &&
              r.request.method === safeRequest.method &&
              r.request.url === safeRequest.url)
        );

        if (!existingReqInCloud) {
          const newReqId = ensureValidUuid(localReq.id);
          const reqCreatedAt = new Date(localReq.createdAt || Date.now()).toISOString();
          const reqUpdatedAt = new Date(localReq.updatedAt || Date.now()).toISOString();

          const { data: insertedReq, error: reqErr } = await supabase
            .from('saved_requests')
            .insert({
              id: newReqId,
              collection_id: targetCollectionId,
              folder_id: null,
              user_id: currentUserId,
              name: reqName,
              request: safeRequest,
              order_index: typeof localReq.orderIndex === 'number' ? localReq.orderIndex : reqIdx,
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

    // 100% SUCCESS
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
    return {
      didMigrate: false,
      migratedCount: 0,
      collections: cloudCollections,
      error,
    };
  }
}

