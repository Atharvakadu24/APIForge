import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
}

/**
 * Validates whether the required Supabase environment variables are present and non-empty.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missingKeys: string[] = [];

  if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
    missingKeys.push('VITE_SUPABASE_URL');
  }

  if (
    !supabasePublishableKey ||
    typeof supabasePublishableKey !== 'string' ||
    !supabasePublishableKey.trim()
  ) {
    missingKeys.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

/**
 * Creates and initializes the Supabase client instance.
 * Warns with a detailed message if environment variables are missing.
 */
function createSupabaseClient(): SupabaseClient {
  const status = getSupabaseConfigStatus();

  if (!status.isConfigured) {
    console.warn(
      `[APIForge Supabase] Missing required environment variables: ${status.missingKeys.join(
        ', '
      )}. Please provide them in frontend/.env.local (refer to frontend/.env.example).`
    );
  }

  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabasePublishableKey || 'placeholder-anon-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}

export const supabase: SupabaseClient = createSupabaseClient();

/**
 * Performs a lightweight, non-destructive check to verify client initialization and connectivity.
 * Uses auth.getSession() which does not write data, alter state, or bypass Row-Level Security (RLS).
 */
export async function verifySupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  const status = getSupabaseConfigStatus();

  if (!status.isConfigured) {
    return {
      success: false,
      message: 'Supabase client is not configured.',
      error: `Missing environment variable(s): ${status.missingKeys.join(', ')}`,
    };
  }

  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      return {
        success: false,
        message: 'Supabase client initialized, but session verification returned an error.',
        error: error.message,
      };
    }

    return {
      success: true,
      message: 'Supabase client initialized and connected successfully.',
    };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown network or initialization error';
    return {
      success: false,
      message: 'Failed to connect to Supabase endpoint.',
      error: errorMessage,
    };
  }
}
