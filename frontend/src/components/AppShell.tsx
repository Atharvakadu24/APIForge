import React, { useState } from 'react';
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleSelectSavedRequest = (req: SavedRequest) => {
    setIsMobileSidebarOpen(false);
    onSelectSavedRequest(req);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setIsMobileSidebarOpen(false);
    onSelectHistory(item);
  };

  const handleNewRequest = () => {
    setIsMobileSidebarOpen(false);
    onNewRequest();
  };

  const sidebarElement = (
    <Sidebar
      collections={collections}
      isLoadingCollections={isLoadingCollections}
      activeSavedRequestId={activeSavedRequestId}
      onSelectSavedRequest={handleSelectSavedRequest}
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
      onNewRequest={handleNewRequest}
      history={history}
      selectedHistoryId={selectedHistoryId}
      selectedHistoryIds={selectedHistoryIds}
      onSelectHistory={handleSelectHistory}
      onToggleSelectHistory={onToggleSelectHistory}
      onToggleSelectAllHistory={onToggleSelectAllHistory}
      onDeleteSelectedHistory={onDeleteSelectedHistory}
      onClearHistory={onClearHistory}
      onDeleteHistoryItem={onDeleteHistoryItem}
    />
  );

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
        isMobileSidebarOpen={isMobileSidebarOpen}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Navigation Sidebar (Desktop: pinned) */}
        <div className="hidden sm:block h-full">
          {sidebarElement}
        </div>

        {/* Mobile Sidebar Drawer Overlay (Phone/Tablet) */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex sm:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-fade-in"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-over Drawer Panel */}
            <div className="relative flex flex-col w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 shadow-2xl z-10 animate-fade-in">
              {/* Drawer Header with Title & Accessible Close Button */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Workspace Navigation
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close navigation sidebar"
                  title="Close sidebar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {sidebarElement}
              </div>
            </div>
          </div>
        )}

        {/* Content Pane */}
        <main className="flex-1 flex flex-col p-2 sm:p-4 overflow-y-auto min-w-0 bg-slate-950/40 relative">
          {children}
        </main>
      </div>
    </div>
  );
}

