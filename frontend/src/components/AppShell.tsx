import React from 'react';
import type { User } from '@supabase/supabase-js';
import Header from './Header';
import Sidebar from './Sidebar';
import type { HistoryItem } from '../types/history';
import type { Collection, CollectionFolder, SavedRequest } from '../types/collection';
import type { Environment } from '../types/environment';

interface AppShellProps {
  children: React.ReactNode;
  collections: Collection[];
  isLoadingCollections?: boolean;
  activeSavedRequestId: string | null;
  onSelectSavedRequest: (request: SavedRequest) => void;
  onOpenCreateCollection: () => void;
  onOpenRenameCollection: (collection: Collection) => void;
  onDeleteCollectionPrompt: (collection: Collection) => void;
  onOpenCreateFolder: (collectionId: string, parentFolderId?: string | null) => void;
  onOpenRenameFolder: (folder: CollectionFolder) => void;
  onDeleteFolderPrompt: (folder: CollectionFolder, collection: Collection) => void;
  onOpenMoveRequest: (request: SavedRequest) => void;
  onOpenMoveFolder: (folder: CollectionFolder, collection: Collection) => void;
  onDeleteSavedRequest: (collectionId: string, requestId: string, e: React.MouseEvent) => void;
  onReorderCollections: (direction: 'up' | 'down', collectionId: string) => void;
  onReorderFolders: (direction: 'up' | 'down', collectionId: string, parentFolderId: string | null, folderId: string) => void;
  onReorderRequests: (direction: 'up' | 'down', collectionId: string, folderId: string | null, requestId: string) => void;
  onNewRequest: () => void;
  history: HistoryItem[];
  selectedHistoryId: string | null;
  selectedHistoryIds?: string[];
  onSelectHistory: (item: HistoryItem) => void;
  onToggleSelectHistory?: (id: string) => void;
  onToggleSelectAllHistory?: () => void;
  onDeleteSelectedHistory?: () => void;
  onClearHistory: () => void;
  onDeleteHistoryItem?: (id: string, e: React.MouseEvent) => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string | null) => void;
  onOpenEnvironmentManager: () => void;
  onOpenCommandPalette?: () => void;
  user?: User | null;
  onSignOut?: () => void;
}

export default function AppShell({
  children,
  collections,
  isLoadingCollections = false,
  activeSavedRequestId,
  onSelectSavedRequest,
  onOpenCreateCollection,
  onOpenRenameCollection,
  onDeleteCollectionPrompt,
  onOpenCreateFolder,
  onOpenRenameFolder,
  onDeleteFolderPrompt,
  onOpenMoveRequest,
  onOpenMoveFolder,
  onDeleteSavedRequest,
  onReorderCollections,
  onReorderFolders,
  onReorderRequests,
  onNewRequest,
  history,
  selectedHistoryId,
  selectedHistoryIds,
  onSelectHistory,
  onToggleSelectHistory,
  onToggleSelectAllHistory,
  onDeleteSelectedHistory,
  onClearHistory,
  onDeleteHistoryItem,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onOpenEnvironmentManager,
  onOpenCommandPalette,
  user = null,
  onSignOut,
}: AppShellProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden text-slate-100">
      {/* Top Application Header */}
      <Header
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={onSelectEnvironment}
        onOpenEnvironmentManager={onOpenEnvironmentManager}
        onOpenCommandPalette={onOpenCommandPalette}
        user={user}
        onSignOut={onSignOut}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="hidden sm:block h-full">
          <Sidebar
            collections={collections}
            isLoadingCollections={isLoadingCollections}
            activeSavedRequestId={activeSavedRequestId}
            onSelectSavedRequest={onSelectSavedRequest}
            onOpenCreateCollection={onOpenCreateCollection}
            onOpenRenameCollection={onOpenRenameCollection}
            onDeleteCollectionPrompt={onDeleteCollectionPrompt}
            onOpenCreateFolder={onOpenCreateFolder}
            onOpenRenameFolder={onOpenRenameFolder}
            onDeleteFolderPrompt={onDeleteFolderPrompt}
            onOpenMoveRequest={onOpenMoveRequest}
            onOpenMoveFolder={onOpenMoveFolder}
            onDeleteSavedRequest={onDeleteSavedRequest}
            onReorderCollections={onReorderCollections}
            onReorderFolders={onReorderFolders}
            onReorderRequests={onReorderRequests}
            onNewRequest={onNewRequest}
            history={history}
            selectedHistoryId={selectedHistoryId}
            selectedHistoryIds={selectedHistoryIds}
            onSelectHistory={onSelectHistory}
            onToggleSelectHistory={onToggleSelectHistory}
            onToggleSelectAllHistory={onToggleSelectAllHistory}
            onDeleteSelectedHistory={onDeleteSelectedHistory}
            onClearHistory={onClearHistory}
            onDeleteHistoryItem={onDeleteHistoryItem}
          />
        </div>

        {/* Content Pane */}
        <main className="flex-1 flex flex-col p-4 overflow-y-auto min-w-0 bg-slate-950/40 relative">
          {children}
        </main>
      </div>
    </div>
  );
}

