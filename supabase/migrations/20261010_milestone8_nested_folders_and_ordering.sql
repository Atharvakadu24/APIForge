-- ==============================================================================
-- APIForge Milestone 8 Database Migration: Nested Folders, Persistent Ordering & Hierarchy
-- ==============================================================================
-- This migration script establishes the schema for:
-- 1. Arbitrary-depth nested collection folders (collection_folders)
-- 2. Persistent ordering (order_index) for collections, folders, and saved requests
-- 3. Row-Level Security (RLS) policies ensuring strict user tenant isolation
-- 4. Foreign key cascading rules and performant indexes
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. COLLECTIONS TABLE & ORDERING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure order_index column exists if table pre-existed
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
END $$;

-- Backfill NULL order_index values if any exist
UPDATE public.collections SET order_index = 0 WHERE order_index IS NULL;

-- Indexes for collections
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_order ON public.collections(user_id, order_index ASC);

-- Enable RLS on collections
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Collections RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collections' AND policyname = 'Users can view own collections') THEN
        CREATE POLICY "Users can view own collections" ON public.collections
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collections' AND policyname = 'Users can insert own collections') THEN
        CREATE POLICY "Users can insert own collections" ON public.collections
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collections' AND policyname = 'Users can update own collections') THEN
        CREATE POLICY "Users can update own collections" ON public.collections
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collections' AND policyname = 'Users can delete own collections') THEN
        CREATE POLICY "Users can delete own collections" ON public.collections
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. COLLECTION FOLDERS TABLE (Arbitrary Nesting Hierarchy)
-- ------------------------------------------------------------------------------
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

-- Indexes for collection_folders
CREATE INDEX IF NOT EXISTS idx_collection_folders_collection_id ON public.collection_folders(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_folders_parent_id ON public.collection_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_collection_folders_user_id ON public.collection_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_folders_order ON public.collection_folders(collection_id, parent_folder_id, order_index ASC);

-- Enable RLS on collection_folders
ALTER TABLE public.collection_folders ENABLE ROW LEVEL SECURITY;

-- Collection Folders RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collection_folders' AND policyname = 'Users can view own folders') THEN
        CREATE POLICY "Users can view own folders" ON public.collection_folders
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collection_folders' AND policyname = 'Users can insert own folders') THEN
        CREATE POLICY "Users can insert own folders" ON public.collection_folders
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collection_folders' AND policyname = 'Users can update own folders') THEN
        CREATE POLICY "Users can update own folders" ON public.collection_folders
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'collection_folders' AND policyname = 'Users can delete own folders') THEN
        CREATE POLICY "Users can delete own folders" ON public.collection_folders
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. SAVED REQUESTS TABLE (Folder Association & Ordering)
-- ------------------------------------------------------------------------------
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

-- Ensure folder_id and order_index columns exist if saved_requests pre-existed
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
END $$;

-- Backfill NULL order_index values on saved_requests
UPDATE public.saved_requests SET order_index = 0 WHERE order_index IS NULL;

-- Indexes for saved_requests
CREATE INDEX IF NOT EXISTS idx_saved_requests_collection_id ON public.saved_requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_folder_id ON public.saved_requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_user_id ON public.saved_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_requests_order ON public.saved_requests(collection_id, folder_id, order_index ASC);

-- Enable RLS on saved_requests
ALTER TABLE public.saved_requests ENABLE ROW LEVEL SECURITY;

-- Saved Requests RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_requests' AND policyname = 'Users can view own saved requests') THEN
        CREATE POLICY "Users can view own saved requests" ON public.saved_requests
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_requests' AND policyname = 'Users can insert own saved requests') THEN
        CREATE POLICY "Users can insert own saved requests" ON public.saved_requests
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_requests' AND policyname = 'Users can update own saved requests') THEN
        CREATE POLICY "Users can update own saved requests" ON public.saved_requests
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_requests' AND policyname = 'Users can delete own saved requests') THEN
        CREATE POLICY "Users can delete own saved requests" ON public.saved_requests
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
