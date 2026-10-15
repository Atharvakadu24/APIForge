import React, { useState, useEffect } from 'react';
import type { HistoryItem } from '../types/history';
import type { Collection, CollectionFolder, SavedRequest } from '../types/collection';

export interface SidebarProps {
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
}

const getMethodBadgeColor = (method: string) => {
  switch (method) {
    case 'GET': return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
    case 'POST': return 'text-sky-400 bg-sky-950/60 border-sky-800/40';
    case 'PUT': return 'text-amber-400 bg-amber-950/60 border-amber-800/40';
    case 'DELETE': return 'text-rose-400 bg-rose-950/60 border-rose-800/40';
    case 'PATCH': return 'text-purple-400 bg-purple-950/60 border-purple-800/40';
    default: return 'text-slate-400 bg-slate-900 border-slate-800';
  }
};

const getStatusBadgeColor = (status: number) => {
  if (status >= 200 && status < 300) {
    return 'text-emerald-400 bg-emerald-950/40';
  }
  if (status >= 300 && status < 400) {
    return 'text-cyan-400 bg-cyan-950/40';
  }
  if (status >= 400 && status < 500) {
    return 'text-amber-400 bg-amber-950/40';
  }
  return 'text-rose-400 bg-rose-950/40';
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatLatency = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

function countRequestsInFolder(folder: CollectionFolder): number {
  let count = folder.requests?.length || 0;
  if (folder.subfolders) {
    for (const sub of folder.subfolders) {
      count += countRequestsInFolder(sub);
    }
  }
  return count;
}

interface FolderTreeItemProps {
  folder: CollectionFolder;
  collection: Collection;
  index: number;
  totalSiblings: number;
  activeSavedRequestId: string | null;
  expandedFolders: Record<string, boolean>;
  openMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onToggleFolder: (id: string) => void;
  onSelectSavedRequest: (request: SavedRequest) => void;
  onOpenCreateFolder: (collectionId: string, parentFolderId?: string | null) => void;
  onOpenRenameFolder: (folder: CollectionFolder) => void;
  onDeleteFolderPrompt: (folder: CollectionFolder, collection: Collection) => void;
  onOpenMoveRequest: (request: SavedRequest) => void;
  onOpenMoveFolder: (folder: CollectionFolder, collection: Collection) => void;
  onDeleteSavedRequest: (collectionId: string, requestId: string, e: React.MouseEvent) => void;
  onReorderFolders: (direction: 'up' | 'down', collectionId: string, parentFolderId: string | null, folderId: string) => void;
  onReorderRequests: (direction: 'up' | 'down', collectionId: string, folderId: string | null, requestId: string) => void;
}

function FolderTreeItem({
  folder,
  collection,
  index,
  totalSiblings,
  activeSavedRequestId,
  expandedFolders,
  openMenuId,
  onToggleMenu,
  onCloseMenu,
  onToggleFolder,
  onSelectSavedRequest,
  onOpenCreateFolder,
  onOpenRenameFolder,
  onDeleteFolderPrompt,
  onOpenMoveRequest,
  onOpenMoveFolder,
  onDeleteSavedRequest,
  onReorderFolders,
  onReorderRequests,
}: FolderTreeItemProps) {
  const isExpanded = expandedFolders[folder.id] !== false; // expanded by default
  const totalCount = countRequestsInFolder(folder);
  const requests = folder.requests || [];
  const subfolders = folder.subfolders || [];
  const isFolderMenuOpen = openMenuId === `folder-${folder.id}`;

  return (
    <div className="space-y-0.5 group/folder">
      {/* Folder Header */}
      <div
        onClick={() => onToggleFolder(folder.id)}
        className="flex items-center justify-between px-1.5 py-1 hover:bg-slate-800/70 rounded-md cursor-pointer transition text-xs text-slate-300 font-medium relative"
      >
        <div className="flex items-center space-x-1 min-w-0 flex-1 mr-1">
          <svg
            className={`w-2.5 h-2.5 text-slate-500 shrink-0 transition-transform duration-150 ${isExpanded ? 'transform rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>

          <span className="truncate text-slate-200">{folder.name}</span>
          <span className="text-[10px] text-slate-500 font-mono shrink-0">({totalCount})</span>
        </div>

        {/* Compact Folder Overflow Menu Trigger */}
        <div className="relative shrink-0 ml-1" data-sidebar-menu>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(`folder-${folder.id}`);
            }}
            className={`p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition cursor-pointer ${
              isFolderMenuOpen
                ? 'opacity-100 bg-slate-700 text-slate-100 ring-1 ring-slate-600'
                : 'opacity-0 group-hover/folder:opacity-100 focus:opacity-100'
            }`}
            title="Folder options"
            aria-label={`Options for folder ${folder.name}`}
            aria-haspopup="true"
            aria-expanded={isFolderMenuOpen}
          >
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {isFolderMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-50 w-44 bg-slate-900 border border-slate-750 rounded-lg shadow-2xl py-1 text-xs divide-y divide-slate-800 animate-fade-in"
              role="menu"
            >
              <div className="py-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onOpenCreateFolder(collection.id, folder.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-amber-300 hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Subfolder</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onOpenRenameFolder(folder);
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Rename Folder</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onOpenMoveFolder(folder, collection);
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-indigo-300 hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Move Location</span>
                </button>
              </div>

              <div className="py-0.5">
                <button
                  type="button"
                  role="menuitem"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onReorderFolders('up', collection.id, folder.parentFolderId, folder.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                  <span>Move Up</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={index === totalSiblings - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onReorderFolders('down', collection.id, folder.parentFolderId, folder.id);
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>Move Down</span>
                </button>
              </div>

              <div className="py-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onDeleteFolderPrompt(folder, collection);
                  }}
                  className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Folder</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Folder Content (Subfolders + Requests) */}
      {isExpanded && (
        <div className="pl-2.5 space-y-0.5 border-l border-slate-800/70 ml-1.5 my-0.5">
          {/* Subfolders */}
          {subfolders.map((sub, sIdx) => (
            <FolderTreeItem
              key={sub.id}
              folder={sub}
              collection={collection}
              index={sIdx}
              totalSiblings={subfolders.length}
              activeSavedRequestId={activeSavedRequestId}
              expandedFolders={expandedFolders}
              openMenuId={openMenuId}
              onToggleMenu={onToggleMenu}
              onCloseMenu={onCloseMenu}
              onToggleFolder={onToggleFolder}
              onSelectSavedRequest={onSelectSavedRequest}
              onOpenCreateFolder={onOpenCreateFolder}
              onOpenRenameFolder={onOpenRenameFolder}
              onDeleteFolderPrompt={onDeleteFolderPrompt}
              onOpenMoveRequest={onOpenMoveRequest}
              onOpenMoveFolder={onOpenMoveFolder}
              onDeleteSavedRequest={onDeleteSavedRequest}
              onReorderFolders={onReorderFolders}
              onReorderRequests={onReorderRequests}
            />
          ))}

          {/* Requests in this folder */}
          {requests.map((req, rIdx) => {
            const isSelected = activeSavedRequestId === req.id;
            const method = req.request.method;
            const isReqMenuOpen = openMenuId === `req-${req.id}`;

            return (
              <div
                key={req.id}
                onClick={() => onSelectSavedRequest(req)}
                className={`group/req flex items-center justify-between px-1.5 py-1 rounded cursor-pointer transition text-[11px] relative ${
                  isSelected
                    ? 'bg-slate-800 text-indigo-300 font-medium ring-1 ring-indigo-500/40'
                    : 'text-slate-350 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
                title={req.request.url}
              >
                <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-1">
                  <span className={`text-[8px] font-bold font-mono px-1 py-0.2 rounded border shrink-0 ${getMethodBadgeColor(method)}`}>
                    {method}
                  </span>
                  <span className="truncate text-slate-200">{req.name}</span>
                </div>

                {/* Compact Request Overflow Menu Trigger */}
                <div className="relative shrink-0 ml-1" data-sidebar-menu>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMenu(`req-${req.id}`);
                    }}
                    className={`p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition cursor-pointer ${
                      isReqMenuOpen
                        ? 'opacity-100 bg-slate-700 text-slate-100 ring-1 ring-slate-600'
                        : 'opacity-0 group-hover/req:opacity-100 focus:opacity-100'
                    }`}
                    title="Request options"
                    aria-label={`Options for request ${req.name}`}
                    aria-haspopup="true"
                    aria-expanded={isReqMenuOpen}
                  >
                    <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>

                  {isReqMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full mt-1 z-50 w-40 bg-slate-900 border border-slate-750 rounded-lg shadow-2xl py-1 text-xs divide-y divide-slate-800 animate-fade-in"
                      role="menu"
                    >
                      <div className="py-0.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloseMenu();
                            onOpenMoveRequest(req);
                          }}
                          className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-indigo-300 hover:bg-slate-800/80 transition cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span>Move Location</span>
                        </button>
                      </div>

                      <div className="py-0.5">
                        <button
                          type="button"
                          role="menuitem"
                          disabled={rIdx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloseMenu();
                            onReorderRequests('up', collection.id, folder.id, req.id);
                          }}
                          className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                          </svg>
                          <span>Move Up</span>
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          disabled={rIdx === requests.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloseMenu();
                            onReorderRequests('down', collection.id, folder.id, req.id);
                          }}
                          className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                          <span>Move Down</span>
                        </button>
                      </div>

                      <div className="py-0.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(e) => {
                            onCloseMenu();
                            onDeleteSavedRequest(collection.id, req.id, e);
                          }}
                          className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete Request</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {subfolders.length === 0 && requests.length === 0 && (
            <div className="px-2 py-1 text-[10px] text-slate-500 italic">
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
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
  selectedHistoryIds = [],
  onSelectHistory,
  onToggleSelectHistory,
  onToggleSelectAllHistory,
  onDeleteSelectedHistory,
  onClearHistory,
  onDeleteHistoryItem,
}: SidebarProps) {
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-sidebar-menu]')) {
        setOpenMenuId(null);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
      }
    };

    window.addEventListener('pointerdown', handleGlobalPointerDown);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isCollectionExpanded = (id: string) => {
    return expandedCollections[id] !== false; // Expanded by default
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleToggleMenu = (id: string) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  const handleCloseMenu = () => {
    setOpenMenuId(null);
  };

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-sm flex flex-col h-full app-height shrink-0 overflow-hidden">
      {/* New Request Button */}
      <div className="p-3 shrink-0">
        <button
          onClick={onNewRequest}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 shadow-md shadow-indigo-500/10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Request</span>
        </button>
      </div>

      <div className="h-px bg-slate-850 mx-3 shrink-0" />

      {/* Main navigation / lists */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-5">
        {/* Collections Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Collections</span>
              {isLoadingCollections ? (
                <svg className="animate-spin h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                collections.length > 0 && (
                  <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full">
                    {collections.length}
                  </span>
                )
              )}
            </div>
            <button
              onClick={onOpenCreateCollection}
              className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800 p-1 rounded transition cursor-pointer"
              title="Create new collection"
              aria-label="Create new collection"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="space-y-1">
            {isLoadingCollections ? (
              <div className="px-3 py-4 space-y-2">
                <div className="h-6 bg-slate-850/60 rounded animate-pulse" />
                <div className="h-6 bg-slate-850/40 rounded animate-pulse" />
              </div>
            ) : collections.length === 0 ? (
              <div className="px-3 py-5 text-center bg-slate-900/30 rounded-lg border border-dashed border-slate-850">
                <svg className="w-5 h-5 mx-auto mb-1.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-[11px] text-slate-400 font-medium">No collections yet</p>
                <button
                  onClick={onOpenCreateCollection}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold mt-1 inline-block cursor-pointer"
                >
                  + New Collection
                </button>
              </div>
            ) : (
              collections.map((col, colIdx) => {
                const expanded = isCollectionExpanded(col.id);
                const folders = col.folders || [];
                const rootRequests = col.requests || [];
                let totalReqCount = rootRequests.length;
                for (const f of folders) {
                  totalReqCount += countRequestsInFolder(f);
                }
                const isColMenuOpen = openMenuId === `col-${col.id}`;

                return (
                  <div key={col.id} className="space-y-0.5 group/col">
                    {/* Collection Header */}
                    <div
                      onClick={() => toggleCollection(col.id)}
                      className="flex items-center justify-between px-1.5 py-1.5 hover:bg-slate-800/80 rounded-md cursor-pointer transition text-xs text-slate-300 font-medium relative"
                    >
                      <div className="flex items-center space-x-1 min-w-0 flex-1 mr-1">
                        <svg
                          className={`w-2.5 h-2.5 text-slate-500 shrink-0 transition-transform duration-150 ${expanded ? 'transform rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>

                        <svg className="w-3 h-3 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>

                        <span className="truncate text-slate-200">{col.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">({totalReqCount})</span>
                      </div>

                      {/* Compact Collection Overflow Menu Trigger */}
                      <div className="relative shrink-0 ml-1" data-sidebar-menu>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMenu(`col-${col.id}`);
                          }}
                          className={`p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition cursor-pointer ${
                            isColMenuOpen
                              ? 'opacity-100 bg-slate-700 text-slate-100 ring-1 ring-slate-600'
                              : 'opacity-0 group-hover/col:opacity-100 focus:opacity-100'
                          }`}
                          title="Collection options"
                          aria-label={`Options for collection ${col.name}`}
                          aria-haspopup="true"
                          aria-expanded={isColMenuOpen}
                        >
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>

                        {isColMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 z-50 w-44 bg-slate-900 border border-slate-750 rounded-lg shadow-2xl py-1 text-xs divide-y divide-slate-800 animate-fade-in"
                            role="menu"
                          >
                            <div className="py-0.5">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseMenu();
                                  onOpenCreateFolder(col.id, null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-amber-300 hover:bg-slate-800/80 transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>New Folder</span>
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseMenu();
                                  onOpenRenameCollection(col);
                                }}
                                className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span>Rename Collection</span>
                              </button>
                            </div>

                            <div className="py-0.5">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={colIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseMenu();
                                  onReorderCollections('up', col.id);
                                }}
                                className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                </svg>
                                <span>Move Up</span>
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                disabled={colIdx === collections.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseMenu();
                                  onReorderCollections('down', col.id);
                                }}
                                className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                                <span>Move Down</span>
                              </button>
                            </div>

                            <div className="py-0.5">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseMenu();
                                  onDeleteCollectionPrompt(col);
                                }}
                                className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete Collection</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content under Collection (Folders + Root Requests) */}
                    {expanded && (
                      <div className="pl-2.5 space-y-0.5 border-l border-slate-800/80 ml-1.5 my-0.5">
                        {/* Folders */}
                        {folders.map((folder, fIdx) => (
                          <FolderTreeItem
                            key={folder.id}
                            folder={folder}
                            collection={col}
                            index={fIdx}
                            totalSiblings={folders.length}
                            activeSavedRequestId={activeSavedRequestId}
                            expandedFolders={expandedFolders}
                            openMenuId={openMenuId}
                            onToggleMenu={handleToggleMenu}
                            onCloseMenu={handleCloseMenu}
                            onToggleFolder={toggleFolder}
                            onSelectSavedRequest={onSelectSavedRequest}
                            onOpenCreateFolder={onOpenCreateFolder}
                            onOpenRenameFolder={onOpenRenameFolder}
                            onDeleteFolderPrompt={onDeleteFolderPrompt}
                            onOpenMoveRequest={onOpenMoveRequest}
                            onOpenMoveFolder={onOpenMoveFolder}
                            onDeleteSavedRequest={onDeleteSavedRequest}
                            onReorderFolders={onReorderFolders}
                            onReorderRequests={onReorderRequests}
                          />
                        ))}

                        {/* Root Requests */}
                        {rootRequests.map((req, rIdx) => {
                          const isSelected = activeSavedRequestId === req.id;
                          const method = req.request.method;
                          const isReqMenuOpen = openMenuId === `rootreq-${req.id}`;

                          return (
                            <div
                              key={req.id}
                              onClick={() => onSelectSavedRequest(req)}
                              className={`group/req flex items-center justify-between px-1.5 py-1 rounded cursor-pointer transition text-[11px] relative ${
                                isSelected
                                  ? 'bg-slate-800 text-indigo-300 font-medium ring-1 ring-indigo-500/40'
                                  : 'text-slate-350 hover:bg-slate-800/60 hover:text-slate-200'
                              }`}
                              title={req.request.url}
                            >
                              <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-1">
                                <span className={`text-[8px] font-bold font-mono px-1 py-0.2 rounded border shrink-0 ${getMethodBadgeColor(method)}`}>
                                  {method}
                                </span>
                                <span className="truncate text-slate-200">{req.name}</span>
                              </div>

                              {/* Compact Request Overflow Menu Trigger */}
                              <div className="relative shrink-0 ml-1" data-sidebar-menu>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleMenu(`rootreq-${req.id}`);
                                  }}
                                  className={`p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition cursor-pointer ${
                                    isReqMenuOpen
                                      ? 'opacity-100 bg-slate-700 text-slate-100 ring-1 ring-slate-600'
                                      : 'opacity-0 group-hover/req:opacity-100 focus:opacity-100'
                                  }`}
                                  title="Request options"
                                  aria-label={`Options for request ${req.name}`}
                                  aria-haspopup="true"
                                  aria-expanded={isReqMenuOpen}
                                >
                                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="5" cy="12" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="19" cy="12" r="2" />
                                  </svg>
                                </button>

                                {isReqMenuOpen && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 z-50 w-40 bg-slate-900 border border-slate-750 rounded-lg shadow-2xl py-1 text-xs divide-y divide-slate-800 animate-fade-in"
                                    role="menu"
                                  >
                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCloseMenu();
                                          onOpenMoveRequest(req);
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-indigo-300 hover:bg-slate-800/80 transition cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                        <span>Move Location</span>
                                      </button>
                                    </div>

                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={rIdx === 0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCloseMenu();
                                          onReorderRequests('up', col.id, null, req.id);
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                        </svg>
                                        <span>Move Up</span>
                                      </button>

                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={rIdx === rootRequests.length - 1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCloseMenu();
                                          onReorderRequests('down', col.id, null, req.id);
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <span>Move Down</span>
                                      </button>
                                    </div>

                                    <div className="py-0.5">
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={(e) => {
                                          handleCloseMenu();
                                          onDeleteSavedRequest(col.id, req.id, e);
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 flex items-center space-x-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Delete Request</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {folders.length === 0 && rootRequests.length === 0 && (
                          <div className="px-2 py-1 text-[10px] text-slate-500 italic">
                            No requests or folders in this collection
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* History Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center space-x-1.5 min-w-0">
              {history.length > 0 && onToggleSelectAllHistory && (
                <input
                  type="checkbox"
                  checked={history.length > 0 && selectedHistoryIds.length === history.length}
                  onChange={onToggleSelectAllHistory}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0 accent-indigo-600"
                  title={
                    history.length > 0 && selectedHistoryIds.length === history.length
                      ? 'Deselect all history'
                      : 'Select all history'
                  }
                  aria-label="Select all history records"
                />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">History</span>
              {history.length > 0 && (
                <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full shrink-0">
                  {history.length}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {selectedHistoryIds.length > 0 && onDeleteSelectedHistory && (
                <button
                  type="button"
                  onClick={onDeleteSelectedHistory}
                  className="text-[9px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/50 px-1.5 py-0.5 rounded transition cursor-pointer"
                  title={`Delete ${selectedHistoryIds.length} selected items`}
                >
                  Delete ({selectedHistoryIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={onClearHistory}
                disabled={history.length === 0}
                className={`text-[9px] font-semibold transition px-1.5 py-0.5 rounded ${
                  history.length > 0
                    ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer'
                    : 'text-slate-600 opacity-40 cursor-not-allowed'
                }`}
                title={history.length > 0 ? 'Clear all history' : 'History is empty'}
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-1 pr-0.5">
            {history.length === 0 ? (
              <div className="px-3 py-6 text-center bg-slate-900/30 rounded-lg border border-dashed border-slate-850">
                <svg className="w-5 h-5 mx-auto mb-1.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] text-slate-400 font-medium">No request history</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Executed requests will appear here</p>
              </div>
            ) : (
              history.map((item) => {
                const isSelected = selectedHistoryId === item.id;
                const isChecked = selectedHistoryIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectHistory(item)}
                    className={`group relative flex flex-col p-2 rounded-lg cursor-pointer transition border ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500/60 shadow-sm shadow-indigo-500/10'
                        : isChecked
                        ? 'bg-slate-850/80 border-indigo-500/40'
                        : 'bg-slate-900/40 hover:bg-slate-850/80 border-slate-850/80 hover:border-slate-750'
                    }`}
                  >
                    {/* Top Row: Checkbox, Method, Status, Latency, Delete Button */}
                    <div className="flex items-center justify-between mb-1 min-w-0">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        {onToggleSelectHistory && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleSelectHistory(item.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0 accent-indigo-600"
                            title={isChecked ? 'Deselect item' : 'Select item'}
                            aria-label={`Select history item for ${item.url}`}
                          />
                        )}
                        <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0 ${getMethodBadgeColor(item.method)}`}>
                          {item.method}
                        </span>
                        <span className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded shrink-0 ${getStatusBadgeColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5 shrink-0 ml-1">
                        <span className="text-[9px] font-mono text-slate-500 shrink-0">
                          {formatLatency(item.latency)}
                        </span>
                        {onDeleteHistoryItem && (
                          <button
                            type="button"
                            onClick={(e) => onDeleteHistoryItem(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer shrink-0"
                            title="Delete history item"
                            aria-label="Delete history item"
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Truncated URL & Timestamp */}
                    <div className="flex items-center justify-between text-[10px] min-w-0">
                      <span
                        className={`font-mono truncate min-w-0 flex-1 mr-1 ${
                          isSelected ? 'text-indigo-200' : 'text-slate-350 group-hover:text-slate-200'
                        }`}
                        title={item.url}
                      >
                        {item.url}
                      </span>
                      <span className="text-[8px] text-slate-550 shrink-0 ml-1 font-mono">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer info */}
      <div className="p-3 border-t border-slate-850 text-[10px] text-slate-500 font-medium flex items-center justify-between shrink-0 mt-auto">
        <span>Vite-TS Environment</span>
        <span className="text-[9px] text-slate-600 font-mono">v1.0</span>
      </div>
    </aside>
  );
}
