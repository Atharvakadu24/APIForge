import { supabase } from '../lib/supabase';
import type { Environment, EnvironmentVariable } from '../types/environment';
import {
  loadEnvironmentsFromStorage,
  clearEnvironmentsFromStorage,
} from '../utils/environmentStorage';

export interface DatabaseEnvironmentRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  environment_variables?: DatabaseEnvironmentVariableRow[];
}

export interface DatabaseEnvironmentVariableRow {
  id: string;
  environment_id: string;
  user_id: string;
  name: string;
  value: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const LEGACY_ENV_BACKUP_STORAGE_KEY = 'apiforge_environments_legacy_backup';
const MIGRATION_FLAG_PREFIX = 'apiforge_environments_migrated_';

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

function mapRowToVariable(row: DatabaseEnvironmentVariableRow): EnvironmentVariable {
  return {
    id: row.id,
    name: row.name,
    value: row.value,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapRowToEnvironment(row: DatabaseEnvironmentRow): Environment {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    variables: Array.isArray(row.environment_variables)
      ? row.environment_variables
          .map(mapRowToVariable)
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
 * Fetches all environments with their nested variables for the authenticated user.
 */
export async function getEnvironments(): Promise<{
  data: Environment[] | null;
  error: Error | null;
}> {
  try {
    const userId = await getAuthenticatedUserId();

    const { data, error } = await supabase
      .from('environments')
      .select('*, environment_variables(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const environments = (data as DatabaseEnvironmentRow[]).map(mapRowToEnvironment);
    return { data: environments, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch environments';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Creates a new environment in Supabase for the authenticated user.
 */
export async function createEnvironment(
  name: string
): Promise<{ data: Environment | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const newId = ensureValidUuid();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('environments')
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

    const created = mapRowToEnvironment(data as DatabaseEnvironmentRow);
    return { data: created, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create environment';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Renames an existing environment in Supabase.
 */
export async function renameEnvironment(
  id: string,
  newName: string
): Promise<{ data: Environment | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('environments')
      .update({
        name: newName.trim(),
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, environment_variables(*)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const updated = mapRowToEnvironment(data as DatabaseEnvironmentRow);
    return { data: updated, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename environment';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Deletes an environment (and its associated variables) in Supabase.
 */
export async function deleteEnvironment(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    // First delete nested variables explicitly (in case CASCADE is not configured)
    await supabase
      .from('environment_variables')
      .delete()
      .eq('environment_id', id)
      .eq('user_id', userId);

    const { error } = await supabase
      .from('environments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete environment';
    return { error: new Error(msg) };
  }
}

/**
 * Creates a single variable in an environment.
 */
export async function createEnvironmentVariable(
  environmentId: string,
  name: string,
  value: string,
  enabled: boolean = true
): Promise<{ data: EnvironmentVariable | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const newId = ensureValidUuid();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('environment_variables')
      .insert({
        id: newId,
        environment_id: environmentId,
        user_id: userId,
        name: name.trim(),
        value: value,
        enabled: enabled,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const created = mapRowToVariable(data as DatabaseEnvironmentVariableRow);
    return { data: created, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create environment variable';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Updates a single variable in an environment.
 */
export async function updateEnvironmentVariable(
  id: string,
  updates: { name?: string; value?: string; enabled?: boolean }
): Promise<{ data: EnvironmentVariable | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: now,
    };

    if (updates.name !== undefined) updatePayload.name = updates.name.trim();
    if (updates.value !== undefined) updatePayload.value = updates.value;
    if (updates.enabled !== undefined) updatePayload.enabled = updates.enabled;

    const { data, error } = await supabase
      .from('environment_variables')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const updated = mapRowToVariable(data as DatabaseEnvironmentVariableRow);
    return { data: updated, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update environment variable';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Deletes a single variable from Supabase.
 */
export async function deleteEnvironmentVariable(
  id: string
): Promise<{ error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();

    const { error } = await supabase
      .from('environment_variables')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete environment variable';
    return { error: new Error(msg) };
  }
}

/**
 * Synchronizes the entire variables list for an environment:
 * - Inserts new variables
 * - Updates changed variables
 * - Deletes removed variables
 */
export async function updateEnvironmentVariables(
  environmentId: string,
  variables: EnvironmentVariable[]
): Promise<{ data: Environment | null; error: Error | null }> {
  try {
    const userId = await getAuthenticatedUserId();
    const now = new Date().toISOString();

    // 1. Fetch existing variables in database for this environment
    const { data: existingRows, error: fetchErr } = await supabase
      .from('environment_variables')
      .select('*')
      .eq('environment_id', environmentId)
      .eq('user_id', userId);

    if (fetchErr) {
      throw new Error(`Failed to fetch current variables: ${fetchErr.message}`);
    }

    const existingVars = (existingRows as DatabaseEnvironmentVariableRow[]) || [];
    const incomingVarIds = new Set(variables.map((v) => v.id));

    // 2. Identify variables to delete (present in DB but missing from incoming list)
    const toDelete = existingVars.filter((v) => !incomingVarIds.has(v.id));
    for (const delVar of toDelete) {
      const { error: delErr } = await supabase
        .from('environment_variables')
        .delete()
        .eq('id', delVar.id)
        .eq('user_id', userId);

      if (delErr) {
        throw new Error(`Failed to delete removed variable: ${delErr.message}`);
      }
    }

    // 3. Upsert / Insert / Update incoming variables
    for (const incoming of variables) {
      const validId = ensureValidUuid(incoming.id);
      const existing = existingVars.find((v) => v.id === validId || v.id === incoming.id);

      if (existing) {
        // Update existing variable
        const { error: upErr } = await supabase
          .from('environment_variables')
          .update({
            name: incoming.name.trim(),
            value: incoming.value,
            enabled: incoming.enabled,
            updated_at: now,
          })
          .eq('id', existing.id)
          .eq('user_id', userId);

        if (upErr) {
          throw new Error(`Failed to update variable: ${upErr.message}`);
        }
      } else {
        // Insert new variable
        const { error: insErr } = await supabase
          .from('environment_variables')
          .insert({
            id: validId,
            environment_id: environmentId,
            user_id: userId,
            name: incoming.name.trim(),
            value: incoming.value,
            enabled: incoming.enabled,
            created_at: new Date(incoming.createdAt || Date.now()).toISOString(),
            updated_at: now,
          });

        if (insErr) {
          throw new Error(`Failed to insert variable: ${insErr.message}`);
        }
      }
    }

    // 4. Update the environment's updated_at timestamp
    await supabase
      .from('environments')
      .update({ updated_at: now })
      .eq('id', environmentId)
      .eq('user_id', userId);

    // 5. Fetch and return fresh environment
    const { data: updatedEnvRow, error: envErr } = await supabase
      .from('environments')
      .select('*, environment_variables(*)')
      .eq('id', environmentId)
      .eq('user_id', userId)
      .single();

    if (envErr || !updatedEnvRow) {
      throw new Error(`Failed to fetch updated environment: ${envErr?.message || 'Unknown error'}`);
    }

    const updatedEnv = mapRowToEnvironment(updatedEnvRow as DatabaseEnvironmentRow);
    return { data: updatedEnv, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update environment variables';
    return { data: null, error: new Error(msg) };
  }
}

/**
 * Safely migrates and reconciles legacy localStorage environments with Supabase:
 * - Scans localStorage for legacy environments.
 * - If no local environments exist, marks migration complete and returns cloud environments.
 * - If local environments exist:
 *   - For each local environment, checks if it already exists in the cloud (by ID or name).
 *   - If not in cloud, creates the environment in Supabase.
 *   - For each variable in the local environment, checks if it already exists in the matching cloud environment.
 *   - If not in cloud, creates the variable in Supabase.
 *   - Guarantees NO duplicate environments or variables are created.
 *   - Guarantees NO local data is discarded if cloud already has different or partial data.
 *   - Only on complete success: backs up legacy data and clears active localStorage environments.
 *   - On any failure: keeps localStorage untouched so no data is lost.
 */
export async function syncOrMigrateLegacyEnvironments(
  currentUserId: string,
  cloudEnvironments: Environment[]
): Promise<{
  didMigrate: boolean;
  migratedCount: number;
  environments: Environment[];
  error: Error | null;
}> {
  const migrationFlagKey = `${MIGRATION_FLAG_PREFIX}${currentUserId}`;

  // 1. Check if legacy environments exist in localStorage
  const legacyEnvironments = loadEnvironmentsFromStorage();
  if (!Array.isArray(legacyEnvironments) || legacyEnvironments.length === 0) {
    try {
      localStorage.setItem(migrationFlagKey, Date.now().toString());
    } catch {
      // ignore storage quota issues
    }
    return {
      didMigrate: false,
      migratedCount: 0,
      environments: cloudEnvironments,
      error: null,
    };
  }

  console.log(
    `[APIForge Migration] Inspecting ${legacyEnvironments.length} legacy local environment(s) against ${cloudEnvironments.length} cloud environment(s)...`
  );

  let migratedEnvironmentsCount = 0;
  let migratedVariablesCount = 0;

  try {
    // Maintain a mutable copy of cloud environments for matching during this migration pass
    const workingCloudEnvironments = [...cloudEnvironments];

    for (const localEnv of legacyEnvironments) {
      const envName = (localEnv.name || 'Untitled Environment').trim();
      const localVariables = Array.isArray(localEnv.variables) ? localEnv.variables : [];

      // Check if environment already exists in Supabase (by ID or by case-insensitive name)
      let targetCloudEnv = workingCloudEnvironments.find(
        (e) =>
          (localEnv.id && e.id === localEnv.id) ||
          e.name.trim().toLowerCase() === envName.toLowerCase()
      );

      let targetEnvironmentId: string;

      if (!targetCloudEnv) {
        // Environment does not exist in cloud -> create it
        const newEnvId = ensureValidUuid(localEnv.id);
        const envCreatedAt = new Date(localEnv.createdAt || Date.now()).toISOString();
        const envUpdatedAt = new Date(localEnv.updatedAt || Date.now()).toISOString();

        const { data: insertedEnv, error: envErr } = await supabase
          .from('environments')
          .insert({
            id: newEnvId,
            user_id: currentUserId,
            name: envName,
            created_at: envCreatedAt,
            updated_at: envUpdatedAt,
          })
          .select('*, environment_variables(*)')
          .single();

        if (envErr || !insertedEnv) {
          throw new Error(
            `Failed to create cloud environment "${envName}": ${envErr?.message || 'Unknown database error'}`
          );
        }

        const mappedEnv = mapRowToEnvironment(insertedEnv as DatabaseEnvironmentRow);
        workingCloudEnvironments.push(mappedEnv);
        targetCloudEnv = mappedEnv;
        targetEnvironmentId = mappedEnv.id;
        migratedEnvironmentsCount++;
      } else {
        // Environment already exists in cloud -> use existing cloud environment ID
        targetEnvironmentId = targetCloudEnv.id;
      }

      // Reconcile nested environment variables
      for (const localVar of localVariables) {
        const varName = (localVar.name || '').trim();
        if (!varName) continue; // skip unnamed blank rows

        // Check if variable already exists in target cloud environment
        const existingVarInCloud = targetCloudEnv.variables.find(
          (v) =>
            (localVar.id && v.id === localVar.id) ||
            v.name.trim().toLowerCase() === varName.toLowerCase()
        );

        if (!existingVarInCloud) {
          // Variable missing in cloud -> insert it
          const newVarId = ensureValidUuid(localVar.id);
          const varCreatedAt = new Date(localVar.createdAt || Date.now()).toISOString();
          const varUpdatedAt = new Date(localVar.updatedAt || Date.now()).toISOString();

          const { data: insertedVar, error: varErr } = await supabase
            .from('environment_variables')
            .insert({
              id: newVarId,
              environment_id: targetEnvironmentId,
              user_id: currentUserId,
              name: varName,
              value: localVar.value || '',
              enabled: localVar.enabled !== false,
              created_at: varCreatedAt,
              updated_at: varUpdatedAt,
            })
            .select()
            .single();

          if (varErr || !insertedVar) {
            throw new Error(
              `Failed to migrate variable into environment "${envName}": ${
                varErr?.message || 'Unknown database error'
              }`
            );
          }

          const mappedVar = mapRowToVariable(insertedVar as DatabaseEnvironmentVariableRow);
          targetCloudEnv.variables.push(mappedVar);
          migratedVariablesCount++;
        }
      }
    }

    // 100% SUCCESS: Merge into legacy backup, clear active localStorage environments, and set migration flag
    try {
      const existingBackupRaw = localStorage.getItem(LEGACY_ENV_BACKUP_STORAGE_KEY);
      let backupList: Environment[] = [];
      if (existingBackupRaw) {
        try {
          const parsed = JSON.parse(existingBackupRaw);
          if (Array.isArray(parsed)) backupList = parsed;
        } catch {
          // ignore
        }
      }

      const backupMap = new Map<string, Environment>();
      for (const item of backupList) {
        backupMap.set(item.id || item.name, item);
      }
      for (const item of legacyEnvironments) {
        backupMap.set(item.id || item.name, item);
      }

      localStorage.setItem(LEGACY_ENV_BACKUP_STORAGE_KEY, JSON.stringify(Array.from(backupMap.values())));
      clearEnvironmentsFromStorage();
      localStorage.setItem(migrationFlagKey, Date.now().toString());
    } catch (storageErr) {
      console.warn('[APIForge Migration] Could not backup legacy environments:', storageErr);
    }

    const totalMigrated = migratedEnvironmentsCount + migratedVariablesCount;
    if (totalMigrated > 0) {
      console.log(
        `[APIForge Migration] Successfully reconciled ${migratedEnvironmentsCount} environment(s) and ${migratedVariablesCount} variable(s) to Supabase.`
      );
    } else {
      console.log(
        '[APIForge Migration] All local environments and variables were already present in Supabase. Cleaned up local storage.'
      );
    }

    // Reload latest cloud environments from Supabase
    const { data: freshCloud } = await getEnvironments();
    return {
      didMigrate: totalMigrated > 0,
      migratedCount: totalMigrated,
      environments: freshCloud || workingCloudEnvironments,
      error: null,
    };
  } catch (migrationErr: unknown) {
    const error = migrationErr instanceof Error ? migrationErr : new Error('Migration failed');
    console.error('[APIForge Migration] Error during legacy environment migration/reconciliation:', error);
    // On failure: do NOT clear localStorage environments and do NOT set migration flag
    return {
      didMigrate: false,
      migratedCount: 0,
      environments: cloudEnvironments,
      error,
    };
  }
}
