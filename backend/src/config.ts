import fs from 'fs';
import path from 'path';

/**
 * Helper to safely load environment variables from .env files if process.loadEnvFile is available,
 * or by manual parsing if needed, without requiring external dependencies.
 */
function loadLocalEnv() {
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../frontend/.env.local'),
    path.resolve(process.cwd(), '../frontend/.env'),
  ];

  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      try {
        if (typeof (process as any).loadEnvFile === 'function') {
          (process as any).loadEnvFile(file);
        } else {
          // Manual fallback parser for simple key=value pairs
          const content = fs.readFileSync(file, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.slice(0, eqIndex).trim();
              const value = trimmed.slice(eqIndex + 1).trim();
              if (key && !process.env[key]) {
                process.env[key] = value.replace(/^["'](.*)["']$/, '$1');
              }
            }
          }
        }
      } catch {
        // Silently continue if an individual file fails to load
      }
    }
  }
}

// Attempt to load local environment files
loadLocalEnv();

const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  ALLOWED_ORIGINS: Array.from(new Set([...defaultOrigins, ...configuredOrigins])),
  SUPABASE_URL:
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '',
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '',
};

/**
 * Validates whether Supabase configuration is present on the backend.
 */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
}
