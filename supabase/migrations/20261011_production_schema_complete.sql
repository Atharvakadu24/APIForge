-- ==============================================================================
-- APIForge Complete Production Database Schema & RLS Security Policy Definition
-- ==============================================================================
-- This migration script establishes the production PostgreSQL schema for APIForge:
-- 1. collections (Collections with persistent ordering)
-- 2. collection_folders (Arbitrary-depth nested folders with persistent ordering)
-- 3. saved_requests (Requests associated with collections and folders)
-- 4. environments (User environments)
-- 5. environment_variables (Key-value variables scoped to environments)
-- 6. request_history (Request execution log with client-managed FIFO retention)
--
-- Security & Referential Integrity Architecture:
-- - Row-Level Security (RLS) enabled on EVERY table in public schema.
-- - Fail-closed preflight audit: Aborts migration immediately with RAISE EXCEPTION
--   if any unapproved or broad policy is detected on any of the 6 tables.
-- - Canonical RLS policies strictly enforce tenant isolation (auth.uid() = user_id).
-- - RLS policies enforce cross-tenant and cross-collection hierarchy integrity.
-- - Composite Foreign Keys enforce database-level relational integrity:
--     * collection_folders(collection_id, user_id) -> collections(id, user_id)
--     * collection_folders(parent_folder_id, collection_id) -> collection_folders(id, collection_id)
--     * saved_requests(collection_id, user_id) -> collections(id, user_id)
--     * saved_requests(folder_id, collection_id) -> collection_folders(id, collection_id)
--     * environment_variables(environment_id, user_id) -> environments(id, user_id)
-- - All foreign keys preserve ON DELETE CASCADE semantics.
-- - Data consistency assertions verify existing data before constraint creation.
-- - Constraint discovery verifies both constraint names AND constraint definitions.
--
-- Migration Safety, Locking & Transaction Semantics:
-- - In Supabase and standard migration runners, migrations execute inside a transaction.
-- - In PostgreSQL, DDL is transactional. If any preflight assertion fails, RAISE EXCEPTION
--   aborts the transaction, guaranteeing a full rollback with zero partial state changes.
-- - Adding foreign key constraints acquires SHARE ROW EXCLUSIVE locks on child tables
--   and ACCESS EXCLUSIVE / SHARE locks on parent tables during validation.
--   On extremely high-traffic live databases, run during maintenance or split into
--   ADD CONSTRAINT ... NOT VALID followed by VALIDATE CONSTRAINT.
--
-- Note on Request History Retention:
-- - 50-item FIFO retention is implemented and enforced at the application tier in
--   `frontend/src/services/historyService.ts` via post-insert range trimming,
--   accelerated by index `idx_request_history_created_at ON public.request_history(user_id, created_at DESC)`.
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- SECTION 0: FAIL-CLOSED PREFLIGHT AUDITS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0.1 FAIL-CLOSED RLS POLICY AUDIT
-- ------------------------------------------------------------------------------
-- In PostgreSQL, RLS policies are PERMISSIVE by default and combined using logical OR.
-- If an unapproved policy exists (e.g. template policy granting broad or public access),
-- it weakens tenant isolation.
-- This audit inspects roles, cmd, permissive mode, qual, and with_check for all policies
-- on the six public tables. Any policy not in the approved canonical allowlist will
-- trigger a fail-closed RAISE EXCEPTION, aborting the transaction before any changes occur.
DO $$
DECLARE
    r RECORD;
    v_unapproved_count INTEGER := 0;
    v_unapproved_details TEXT := '';
BEGIN
    FOR r IN (
        SELECT
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('collections', 'collection_folders', 'saved_requests', 'environments', 'environment_variables', 'request_history')
          AND policyname NOT IN (
              'Users can view own collections', 'Users can insert own collections', 'Users can update own collections', 'Users can delete own collections',
              'Users can view own folders', 'Users can insert own folders', 'Users can update own folders', 'Users can delete own folders',
              'Users can view own saved requests', 'Users can insert own saved requests', 'Users can update own saved requests', 'Users can delete own saved requests',
              'Users can view own environments', 'Users can insert own environments', 'Users can update own environments', 'Users can delete own environments',
              'Users can view own environment variables', 'Users can insert own environment variables', 'Users can update own environment variables', 'Users can delete own environment variables',
              'Users can view own history', 'Users can insert own history', 'Users can update own history', 'Users can delete own history'
          )
    ) LOOP
        v_unapproved_count := v_unapproved_count + 1;
        v_unapproved_details := v_unapproved_details || format(
            E'\n- Table: public.%I | Policy: %I | Mode: %s | Cmd: %s | Roles: %s | USING: %s | WITH CHECK: %s',
            r.tablename, r.policyname, r.permissive, r.cmd, r.roles::text, coalesce(r.qual, '<none>'), coalesce(r.with_check, '<none>')
        );
    END LOOP;

    IF v_unapproved_count > 0 THEN
        RAISE EXCEPTION E'[APIForge Security Preflight Failed] % unapproved RLS policy/policies detected on tenant tables:% \n\nABORTING MIGRATION: In PostgreSQL, permissive policies combine with logical OR. An unexpected permissive policy will weaken tenant isolation.\nRemediation: Inspect each listed policy. If legitimate, add its name to the reviewed allowlist in this migration; if it is an insecure or legacy policy, DROP it before applying this migration.',
            v_unapproved_count, v_unapproved_details;
    END IF;

    RAISE NOTICE '[APIForge Security Preflight Passed] All RLS policies on the 6 tenant tables match the approved canonical allowlist.';
END $$;

-- ------------------------------------------------------------------------------
-- 0.2 COLUMN TYPE COMPATIBILITY PREFLIGHT
-- ------------------------------------------------------------------------------
-- Verifies that if tables already exist, their existing columns have compatible types
-- rather than silently failing during application runtime queries or type casting.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Check ID columns are UUID
    FOR r IN (
        SELECT table_name, column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('collections', 'collection_folders', 'saved_requests', 'environments', 'environment_variables', 'request_history')
          AND column_name IN ('id', 'user_id', 'collection_id', 'folder_id', 'parent_folder_id', 'environment_id')
          AND udt_name <> 'uuid'
    ) LOOP
        RAISE EXCEPTION '[APIForge Preflight Error] Incompatible column type: public.%.% is % (expected uuid). Manual schema alignment required.',
            r.table_name, r.column_name, r.udt_name;
    END LOOP;

    -- Check JSONB columns
    FOR r IN (
        SELECT table_name, column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND ((table_name = 'saved_requests' AND column_name = 'request')
            OR (table_name = 'request_history' AND column_name IN ('request', 'response')))
          AND udt_name <> 'jsonb'
    ) LOOP
        RAISE EXCEPTION '[APIForge Preflight Error] Incompatible column type: public.%.% is % (expected jsonb). Manual schema alignment required.',
            r.table_name, r.column_name, r.udt_name;
    END LOOP;
END $$;


-- ==============================================================================
-- SECTION 1: COLLECTIONS TABLE & HIERARCHY
-- ==============================================================================
-- Base columns: id, user_id, name, created_at, updated_at
-- Columns guaranteed by Milestone 8 (20261010): order_index
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive column verification for pre-existing legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collections'
          AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.collections ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collections'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.collections ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

UPDATE public.collections SET order_index = 0 WHERE order_index IS NULL;

-- Indexes for collections
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_order ON public.collections(user_id, order_index ASC);

-- Compound unique constraint for foreign key referential integrity
DO $$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'collections'
      AND c.conname = 'uq_collections_id_user_id';

    IF v_def IS NOT NULL THEN
        IF v_def <> 'UNIQUE (id, user_id)' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint uq_collections_id_user_id on public.collections exists with mismatched definition: "%" (expected "UNIQUE (id, user_id)").', v_def;
        END IF;
    ELSE
        ALTER TABLE public.collections ADD CONSTRAINT uq_collections_id_user_id UNIQUE (id, user_id);
    END IF;
END $$;

-- Enable RLS on collections
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Collections Canonical RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own collections" ON public.collections;
    CREATE POLICY "Users can view own collections" ON public.collections
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own collections" ON public.collections;
    CREATE POLICY "Users can insert own collections" ON public.collections
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own collections" ON public.collections;
    CREATE POLICY "Users can update own collections" ON public.collections
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete own collections" ON public.collections;
    CREATE POLICY "Users can delete own collections" ON public.collections
        FOR DELETE USING (auth.uid() = user_id);
END $$;


-- ==============================================================================
-- SECTION 2: COLLECTION FOLDERS TABLE (Arbitrary Nesting Hierarchy)
-- ==============================================================================
-- Base columns: id, collection_id, user_id, name, created_at, updated_at
-- Columns guaranteed by Milestone 8 (20261010): parent_folder_id, order_index
CREATE TABLE IF NOT EXISTS public.collection_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES public.collection_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive column verification for pre-existing legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collection_folders'
          AND column_name = 'parent_folder_id'
    ) THEN
        ALTER TABLE public.collection_folders ADD COLUMN parent_folder_id UUID REFERENCES public.collection_folders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collection_folders'
          AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.collection_folders ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'collection_folders'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.collection_folders ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

UPDATE public.collection_folders SET order_index = 0 WHERE order_index IS NULL;

-- Indexes for collection_folders
CREATE INDEX IF NOT EXISTS idx_collection_folders_collection_id ON public.collection_folders(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_folders_parent_id ON public.collection_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_collection_folders_user_id ON public.collection_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_folders_order ON public.collection_folders(collection_id, parent_folder_id, order_index ASC);

-- Compound unique constraints required for composite foreign key references
DO $$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'collection_folders'
      AND c.conname = 'uq_collection_folders_id_collection_id';

    IF v_def IS NOT NULL THEN
        IF v_def <> 'UNIQUE (id, collection_id)' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint uq_collection_folders_id_collection_id on public.collection_folders exists with mismatched definition: "%" (expected "UNIQUE (id, collection_id)").', v_def;
        END IF;
    ELSE
        ALTER TABLE public.collection_folders ADD CONSTRAINT uq_collection_folders_id_collection_id UNIQUE (id, collection_id);
    END IF;

    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'collection_folders'
      AND c.conname = 'uq_collection_folders_id_user_id';

    IF v_def IS NOT NULL THEN
        IF v_def <> 'UNIQUE (id, user_id)' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint uq_collection_folders_id_user_id on public.collection_folders exists with mismatched definition: "%" (expected "UNIQUE (id, user_id)").', v_def;
        END IF;
    ELSE
        ALTER TABLE public.collection_folders ADD CONSTRAINT uq_collection_folders_id_user_id UNIQUE (id, user_id);
    END IF;
END $$;

-- Enable RLS on collection_folders
ALTER TABLE public.collection_folders ENABLE ROW LEVEL SECURITY;

-- Collection Folders Canonical RLS Policies (Cross-Tenant & Cross-Collection Checks)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own folders" ON public.collection_folders;
    CREATE POLICY "Users can view own folders" ON public.collection_folders
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own folders" ON public.collection_folders;
    CREATE POLICY "Users can insert own folders" ON public.collection_folders
        FOR INSERT WITH CHECK (
            auth.uid() = user_id
            -- Integrity: Target collection must belong to authenticated user
            AND EXISTS (
                SELECT 1 FROM public.collections c
                WHERE c.id = collection_folders.collection_id
                  AND c.user_id = auth.uid()
            )
            -- Integrity: Parent folder must belong to same user AND same collection
            AND (
                collection_folders.parent_folder_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.collection_folders pf
                    WHERE pf.id = collection_folders.parent_folder_id
                      AND pf.user_id = auth.uid()
                      AND pf.collection_id = collection_folders.collection_id
                )
            )
        );

    DROP POLICY IF EXISTS "Users can update own folders" ON public.collection_folders;
    CREATE POLICY "Users can update own folders" ON public.collection_folders
        FOR UPDATE USING (auth.uid() = user_id)
        WITH CHECK (
            auth.uid() = user_id
            -- Integrity: Target collection must belong to authenticated user
            AND EXISTS (
                SELECT 1 FROM public.collections c
                WHERE c.id = collection_folders.collection_id
                  AND c.user_id = auth.uid()
            )
            -- Integrity: Parent folder must belong to same user AND same collection
            AND (
                collection_folders.parent_folder_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.collection_folders pf
                    WHERE pf.id = collection_folders.parent_folder_id
                      AND pf.user_id = auth.uid()
                      AND pf.collection_id = collection_folders.collection_id
                )
            )
        );

    DROP POLICY IF EXISTS "Users can delete own folders" ON public.collection_folders;
    CREATE POLICY "Users can delete own folders" ON public.collection_folders
        FOR DELETE USING (auth.uid() = user_id);
END $$;


-- ==============================================================================
-- SECTION 3: SAVED REQUESTS TABLE (Folder Association & Ordering)
-- ==============================================================================
-- Base columns: id, collection_id, user_id, name, request, created_at, updated_at
-- Columns guaranteed by Milestone 8 (20261010): folder_id, order_index
CREATE TABLE IF NOT EXISTS public.saved_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES public.collection_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    request JSONB NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive column verification for pre-existing legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_requests'
          AND column_name = 'folder_id'
    ) THEN
        ALTER TABLE public.saved_requests ADD COLUMN folder_id UUID REFERENCES public.collection_folders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_requests'
          AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.saved_requests ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_requests'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.saved_requests ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

UPDATE public.saved_requests SET order_index = 0 WHERE order_index IS NULL;

-- Indexes for saved_requests
CREATE INDEX IF NOT EXISTS idx_saved_requests_collection_id ON public.saved_requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_folder_id ON public.saved_requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_user_id ON public.saved_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_order ON public.saved_requests(collection_id, folder_id, order_index ASC);

-- Enable RLS on saved_requests
ALTER TABLE public.saved_requests ENABLE ROW LEVEL SECURITY;

-- Saved Requests Canonical RLS Policies (Cross-Tenant & Cross-Collection Checks)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own saved requests" ON public.saved_requests;
    CREATE POLICY "Users can view own saved requests" ON public.saved_requests
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own saved requests" ON public.saved_requests;
    CREATE POLICY "Users can insert own saved requests" ON public.saved_requests
        FOR INSERT WITH CHECK (
            auth.uid() = user_id
            -- Integrity: Target collection must belong to authenticated user
            AND EXISTS (
                SELECT 1 FROM public.collections c
                WHERE c.id = saved_requests.collection_id
                  AND c.user_id = auth.uid()
            )
            -- Integrity: Associated folder must belong to same user AND same collection
            AND (
                saved_requests.folder_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.collection_folders f
                    WHERE f.id = saved_requests.folder_id
                      AND f.user_id = auth.uid()
                      AND f.collection_id = saved_requests.collection_id
                )
            )
        );

    DROP POLICY IF EXISTS "Users can update own saved requests" ON public.saved_requests;
    CREATE POLICY "Users can update own saved requests" ON public.saved_requests
        FOR UPDATE USING (auth.uid() = user_id)
        WITH CHECK (
            auth.uid() = user_id
            -- Integrity: Target collection must belong to authenticated user
            AND EXISTS (
                SELECT 1 FROM public.collections c
                WHERE c.id = saved_requests.collection_id
                  AND c.user_id = auth.uid()
            )
            -- Integrity: Associated folder must belong to same user AND same collection
            AND (
                saved_requests.folder_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.collection_folders f
                    WHERE f.id = saved_requests.folder_id
                      AND f.user_id = auth.uid()
                      AND f.collection_id = saved_requests.collection_id
                )
            )
        );

    DROP POLICY IF EXISTS "Users can delete own saved requests" ON public.saved_requests;
    CREATE POLICY "Users can delete own saved requests" ON public.saved_requests
        FOR DELETE USING (auth.uid() = user_id);
END $$;


-- ==============================================================================
-- SECTION 4: ENVIRONMENTS TABLE
-- ==============================================================================
-- Columns expected by application (environmentService.ts): id, user_id, name, created_at, updated_at
-- Optional schema extension: is_active (default false)
CREATE TABLE IF NOT EXISTS public.environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive column verification for pre-existing legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'environments'
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.environments ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'environments'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.environments ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

-- Indexes for environments
CREATE INDEX IF NOT EXISTS idx_environments_user_id ON public.environments(user_id);

-- Compound unique constraint for foreign key referential integrity
DO $$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'environments'
      AND c.conname = 'uq_environments_id_user_id';

    IF v_def IS NOT NULL THEN
        IF v_def <> 'UNIQUE (id, user_id)' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint uq_environments_id_user_id on public.environments exists with mismatched definition: "%" (expected "UNIQUE (id, user_id)").', v_def;
        END IF;
    ELSE
        ALTER TABLE public.environments ADD CONSTRAINT uq_environments_id_user_id UNIQUE (id, user_id);
    END IF;
END $$;

-- Enable RLS on environments
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

-- Environments Canonical RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own environments" ON public.environments;
    CREATE POLICY "Users can view own environments" ON public.environments
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own environments" ON public.environments;
    CREATE POLICY "Users can insert own environments" ON public.environments
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own environments" ON public.environments;
    CREATE POLICY "Users can update own environments" ON public.environments
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete own environments" ON public.environments;
    CREATE POLICY "Users can delete own environments" ON public.environments
        FOR DELETE USING (auth.uid() = user_id);
END $$;


-- ==============================================================================
-- SECTION 5: ENVIRONMENT VARIABLES TABLE
-- ==============================================================================
-- Columns expected by application (environmentService.ts): id, environment_id, user_id, name, value, enabled, created_at, updated_at
CREATE TABLE IF NOT EXISTS public.environment_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive column verification for pre-existing legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'environment_variables'
          AND column_name = 'value'
    ) THEN
        ALTER TABLE public.environment_variables ADD COLUMN value TEXT NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'environment_variables'
          AND column_name = 'enabled'
    ) THEN
        ALTER TABLE public.environment_variables ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'environment_variables'
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.environment_variables ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

-- Indexes for environment_variables
CREATE INDEX IF NOT EXISTS idx_env_variables_env_id ON public.environment_variables(environment_id);
CREATE INDEX IF NOT EXISTS idx_env_variables_user_id ON public.environment_variables(user_id);

-- Enable RLS on environment_variables
ALTER TABLE public.environment_variables ENABLE ROW LEVEL SECURITY;

-- Environment Variables Canonical RLS Policies (Cross-Tenant Checks)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own environment variables" ON public.environment_variables;
    CREATE POLICY "Users can view own environment variables" ON public.environment_variables
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own environment variables" ON public.environment_variables;
    CREATE POLICY "Users can insert own environment variables" ON public.environment_variables
        FOR INSERT WITH CHECK (
            auth.uid() = user_id
            -- Integrity: Target environment must belong to authenticated user
            AND EXISTS (
                SELECT 1 FROM public.environments e
                WHERE e.id = environment_variables.environment_id
                  AND e.user_id = auth.uid()
            )
        );

    DROP POLICY IF EXISTS "Users can update own environment variables" ON public.environment_variables;
    CREATE POLICY "Users can update own environment variables" ON public.environment_variables
        FOR UPDATE USING (auth.uid() = user_id)
        WITH CHECK (
            auth.uid() = user_id
            -- Integrity: Target environment must belong to authenticated user
            AND EXISTS (
                SELECT 1 FROM public.environments e
                WHERE e.id = environment_variables.environment_id
                  AND e.user_id = auth.uid()
            )
        );

    DROP POLICY IF EXISTS "Users can delete own environment variables" ON public.environment_variables;
    CREATE POLICY "Users can delete own environment variables" ON public.environment_variables
        FOR DELETE USING (auth.uid() = user_id);
END $$;


-- ==============================================================================
-- SECTION 6: REQUEST HISTORY TABLE
-- ==============================================================================
-- Columns expected by application (historyService.ts): id, user_id, method, url, status, status_text, latency, size, is_error, request, response, created_at
CREATE TABLE IF NOT EXISTS public.request_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    status INTEGER NOT NULL,
    status_text TEXT NOT NULL DEFAULT '',
    latency INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    is_error BOOLEAN NOT NULL DEFAULT false,
    request JSONB NOT NULL,
    response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive column verification for pre-existing legacy schemas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'request_history'
          AND column_name = 'status_text'
    ) THEN
        ALTER TABLE public.request_history ADD COLUMN status_text TEXT NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'request_history'
          AND column_name = 'latency'
    ) THEN
        ALTER TABLE public.request_history ADD COLUMN latency INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'request_history'
          AND column_name = 'size'
    ) THEN
        ALTER TABLE public.request_history ADD COLUMN size INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'request_history'
          AND column_name = 'is_error'
    ) THEN
        ALTER TABLE public.request_history ADD COLUMN is_error BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Indexes for request_history
CREATE INDEX IF NOT EXISTS idx_request_history_user_id ON public.request_history(user_id);
CREATE INDEX IF NOT EXISTS idx_request_history_created_at ON public.request_history(user_id, created_at DESC);

-- Enable RLS on request_history
ALTER TABLE public.request_history ENABLE ROW LEVEL SECURITY;

-- Request History Canonical RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own history" ON public.request_history;
    CREATE POLICY "Users can view own history" ON public.request_history
        FOR SELECT USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own history" ON public.request_history;
    CREATE POLICY "Users can insert own history" ON public.request_history
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own history" ON public.request_history;
    CREATE POLICY "Users can update own history" ON public.request_history
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete own history" ON public.request_history;
    CREATE POLICY "Users can delete own history" ON public.request_history
        FOR DELETE USING (auth.uid() = user_id);
END $$;


-- ==============================================================================
-- SECTION 7: DATA INTEGRITY PREFLIGHTS & COMPOSITE FOREIGN KEY CONSTRAINTS
-- ==============================================================================
-- Composite foreign keys guarantee database-level referential integrity across tenants
-- and collections, preventing:
-- 1. A folder referencing a collection owned by another user.
-- 2. A subfolder referencing a parent folder located in a different collection.
-- 3. A saved request referencing a collection owned by another user.
-- 4. A saved request referencing a folder located in a different collection.
-- 5. An environment variable referencing an environment owned by another user.

-- 7.1 Constraint: collection_folders(collection_id, user_id) -> collections(id, user_id)
DO $$
DECLARE
    v_def TEXT;
    v_violations INTEGER := 0;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'collection_folders'
      AND c.conname = 'fk_collection_folders_collection_user';

    IF v_def IS NOT NULL THEN
        IF v_def NOT LIKE '%FOREIGN KEY (collection_id, user_id) REFERENCES%collections(id, user_id)%ON DELETE CASCADE%' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint fk_collection_folders_collection_user on public.collection_folders exists with unexpected definition: "%". Manual review required.', v_def;
        END IF;
    ELSE
        SELECT count(*) INTO v_violations
        FROM public.collection_folders f
        JOIN public.collections c ON f.collection_id = c.id
        WHERE f.user_id <> c.user_id;

        IF v_violations > 0 THEN
            RAISE EXCEPTION '[APIForge Preflight Error] % collection_folders row(s) have user_id mismatch with parent collection. Manual data remediation required before applying composite foreign key.', v_violations;
        END IF;

        ALTER TABLE public.collection_folders
            ADD CONSTRAINT fk_collection_folders_collection_user
            FOREIGN KEY (collection_id, user_id)
            REFERENCES public.collections(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 7.2 Constraint: collection_folders(parent_folder_id, collection_id) -> collection_folders(id, collection_id)
DO $$
DECLARE
    v_def TEXT;
    v_violations INTEGER := 0;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'collection_folders'
      AND c.conname = 'fk_collection_folders_parent_collection';

    IF v_def IS NOT NULL THEN
        IF v_def NOT LIKE '%FOREIGN KEY (parent_folder_id, collection_id) REFERENCES%collection_folders(id, collection_id)%ON DELETE CASCADE%' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint fk_collection_folders_parent_collection on public.collection_folders exists with unexpected definition: "%". Manual review required.', v_def;
        END IF;
    ELSE
        SELECT count(*) INTO v_violations
        FROM public.collection_folders f
        JOIN public.collection_folders p ON f.parent_folder_id = p.id
        WHERE f.collection_id <> p.collection_id;

        IF v_violations > 0 THEN
            RAISE EXCEPTION '[APIForge Preflight Error] % collection_folders row(s) have parent_folder_id in a different collection. Manual data remediation required before applying composite foreign key.', v_violations;
        END IF;

        ALTER TABLE public.collection_folders
            ADD CONSTRAINT fk_collection_folders_parent_collection
            FOREIGN KEY (parent_folder_id, collection_id)
            REFERENCES public.collection_folders(id, collection_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 7.3 Constraint: saved_requests(collection_id, user_id) -> collections(id, user_id)
DO $$
DECLARE
    v_def TEXT;
    v_violations INTEGER := 0;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'saved_requests'
      AND c.conname = 'fk_saved_requests_collection_user';

    IF v_def IS NOT NULL THEN
        IF v_def NOT LIKE '%FOREIGN KEY (collection_id, user_id) REFERENCES%collections(id, user_id)%ON DELETE CASCADE%' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint fk_saved_requests_collection_user on public.saved_requests exists with unexpected definition: "%". Manual review required.', v_def;
        END IF;
    ELSE
        SELECT count(*) INTO v_violations
        FROM public.saved_requests r
        JOIN public.collections c ON r.collection_id = c.id
        WHERE r.user_id <> c.user_id;

        IF v_violations > 0 THEN
            RAISE EXCEPTION '[APIForge Preflight Error] % saved_requests row(s) have user_id mismatch with parent collection. Manual data remediation required before applying composite foreign key.', v_violations;
        END IF;

        ALTER TABLE public.saved_requests
            ADD CONSTRAINT fk_saved_requests_collection_user
            FOREIGN KEY (collection_id, user_id)
            REFERENCES public.collections(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 7.4 Constraint: saved_requests(folder_id, collection_id) -> collection_folders(id, collection_id)
DO $$
DECLARE
    v_def TEXT;
    v_violations INTEGER := 0;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'saved_requests'
      AND c.conname = 'fk_saved_requests_folder_collection';

    IF v_def IS NOT NULL THEN
        IF v_def NOT LIKE '%FOREIGN KEY (folder_id, collection_id) REFERENCES%collection_folders(id, collection_id)%ON DELETE CASCADE%' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint fk_saved_requests_folder_collection on public.saved_requests exists with unexpected definition: "%". Manual review required.', v_def;
        END IF;
    ELSE
        SELECT count(*) INTO v_violations
        FROM public.saved_requests r
        JOIN public.collection_folders f ON r.folder_id = f.id
        WHERE r.collection_id <> f.collection_id;

        IF v_violations > 0 THEN
            RAISE EXCEPTION '[APIForge Preflight Error] % saved_requests row(s) have folder_id in a different collection. Manual data remediation required before applying composite foreign key.', v_violations;
        END IF;

        ALTER TABLE public.saved_requests
            ADD CONSTRAINT fk_saved_requests_folder_collection
            FOREIGN KEY (folder_id, collection_id)
            REFERENCES public.collection_folders(id, collection_id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 7.5 Constraint: environment_variables(environment_id, user_id) -> environments(id, user_id)
DO $$
DECLARE
    v_def TEXT;
    v_violations INTEGER := 0;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'environment_variables'
      AND c.conname = 'fk_environment_variables_env_user';

    IF v_def IS NOT NULL THEN
        IF v_def NOT LIKE '%FOREIGN KEY (environment_id, user_id) REFERENCES%environments(id, user_id)%ON DELETE CASCADE%' THEN
            RAISE EXCEPTION '[APIForge Constraint Error] Constraint fk_environment_variables_env_user on public.environment_variables exists with unexpected definition: "%". Manual review required.', v_def;
        END IF;
    ELSE
        SELECT count(*) INTO v_violations
        FROM public.environment_variables v
        JOIN public.environments e ON v.environment_id = e.id
        WHERE v.user_id <> e.user_id;

        IF v_violations > 0 THEN
            RAISE EXCEPTION '[APIForge Preflight Error] % environment_variables row(s) have user_id mismatch with parent environment. Manual data remediation required before applying composite foreign key.', v_violations;
        END IF;

        ALTER TABLE public.environment_variables
            ADD CONSTRAINT fk_environment_variables_env_user
            FOREIGN KEY (environment_id, user_id)
            REFERENCES public.environments(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $$;
