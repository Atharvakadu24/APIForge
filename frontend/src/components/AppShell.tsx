import React from 'react';
import type { User } from '@supabase/supabase-js';
import Header from './Header';
import Sidebar from './Sidebar';
import type { HistoryItem } from '../types/history';
import type { Collection, SavedRequest } from '../types/collection';
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
  onDeleteSavedRequest: (collectionId: string, requestId: string, e: React.MouseEvent) => void;
  onNewRequest: () => void;
  history: HistoryItem[];
  selectedHistoryId: string | null;
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string, e: React.MouseEvent) => void;
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
  onDeleteSavedRequest,
  onNewRequest,
  history,
  selectedHistoryId,
  onSelectHistory,
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
        <div className="hidden sm:block">
          <Sidebar
            collections={collections}
            isLoadingCollections={isLoadingCollections}
            activeSavedRequestId={activeSavedRequestId}
            onSelectSavedRequest={onSelectSavedRequest}
            onOpenCreateCollection={onOpenCreateCollection}
            onOpenRenameCollection={onOpenRenameCollection}
            onDeleteCollectionPrompt={onDeleteCollectionPrompt}
            onDeleteSavedRequest={onDeleteSavedRequest}
            onNewRequest={onNewRequest}
            history={history}
            selectedHistoryId={selectedHistoryId}
            onSelectHistory={onSelectHistory}
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
