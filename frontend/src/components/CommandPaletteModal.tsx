import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Collection, CollectionFolder, SavedRequest } from '../types/collection';
import type { Environment } from '../types/environment';
import type { HistoryItem } from '../types/history';

export type PaletteItemType = 'request' | 'folder' | 'collection' | 'environment' | 'history';

export interface RequestPaletteItem {
  type: 'request';
  id: string;
  title: string;
  subtitle: string;
  method: string;
  url: string;
  collectionName: string;
  breadcrumb: string;
  matchText: string;
  data: SavedRequest;
}

export interface FolderPaletteItem {
  type: 'folder';
  id: string;
  title: string;
  subtitle: string;
  breadcrumb: string;
  requestCount: number;
  matchText: string;
  data: { folder: CollectionFolder; collection: Collection };
}

export interface CollectionPaletteItem {
  type: 'collection';
  id: string;
  title: string;
  subtitle: string;
  requestCount: number;
  matchText: string;
  data: Collection;
}

export interface EnvironmentPaletteItem {
  type: 'environment';
  id: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  matchText: string;
  data: Environment;
}

export interface HistoryPaletteItem {
  type: 'history';
  id: string;
  title: string;
  subtitle: string;
  method: string;
  status: number;
  latency: number;
  timestamp: number;
  url: string;
  matchText: string;
  data: HistoryItem;
}

export type PaletteItem =
  | RequestPaletteItem
  | FolderPaletteItem
  | CollectionPaletteItem
  | EnvironmentPaletteItem
  | HistoryPaletteItem;

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  environments: Environment[];
  history: HistoryItem[];
  activeEnvironmentId: string | null;
  onSelectSavedRequest: (request: SavedRequest) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onSelectEnvironment: (id: string | null) => void;
  onSelectCollection?: (collection: Collection) => void;
  onSelectFolder?: (folder: CollectionFolder, collection: Collection) => void;
}

const getMethodBadgeColor = (method: string) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
    case 'POST':
      return 'text-sky-400 bg-sky-950/60 border-sky-800/40';
    case 'PUT':
      return 'text-amber-400 bg-amber-950/60 border-amber-800/40';
    case 'DELETE':
      return 'text-rose-400 bg-rose-950/60 border-rose-800/40';
    case 'PATCH':
      return 'text-purple-400 bg-purple-950/60 border-purple-800/40';
    default:
      return 'text-slate-400 bg-slate-900 border-slate-800';
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

function countTotalRequestsInFolder(folder: CollectionFolder): number {
  let count = folder.requests?.length || 0;
  if (folder.subfolders) {
    for (const sub of folder.subfolders) {
      count += countTotalRequestsInFolder(sub);
    }
  }
  return count;
}

function countTotalRequestsInCollection(col: Collection): number {
  let count = col.requests?.length || 0;
  if (col.folders) {
    for (const f of col.folders) {
      count += countTotalRequestsInFolder(f);
    }
  }
  return count;
}

function extractFolderAndRequestItems(
  folders: CollectionFolder[],
  col: Collection,
  parentBreadcrumb: string
): { folderItems: FolderPaletteItem[]; requestItems: RequestPaletteItem[] } {
  const folderItems: FolderPaletteItem[] = [];
  const requestItems: RequestPaletteItem[] = [];

  for (const f of folders) {
    const currentBreadcrumb = `${parentBreadcrumb} > ${f.name}`;
    const totalCount = countTotalRequestsInFolder(f);

    folderItems.push({
      type: 'folder',
      id: `folder-${f.id}`,
      title: f.name,
      subtitle: `${currentBreadcrumb} · ${totalCount} request${totalCount === 1 ? '' : 's'}`,
      breadcrumb: currentBreadcrumb,
      requestCount: totalCount,
      matchText: `${f.name} folder ${currentBreadcrumb}`,
      data: { folder: f, collection: col },
    });

    if (f.requests) {
      for (const req of f.requests) {
        requestItems.push({
          type: 'request',
          id: `req-${req.id}`,
          title: req.name,
          subtitle: `${currentBreadcrumb} · ${req.request.url || 'No URL'}`,
          method: req.request.method,
          url: req.request.url,
          collectionName: col.name,
          breadcrumb: currentBreadcrumb,
          matchText: `${req.name} ${req.request.method} ${req.request.url} ${currentBreadcrumb}`,
          data: req,
        });
      }
    }

    if (f.subfolders && f.subfolders.length > 0) {
      const nested = extractFolderAndRequestItems(f.subfolders, col, currentBreadcrumb);
      folderItems.push(...nested.folderItems);
      requestItems.push(...nested.requestItems);
    }
  }

  return { folderItems, requestItems };
}

function CommandPaletteModalContent({
  onClose,
  collections,
  environments,
  history,
  activeEnvironmentId,
  onSelectSavedRequest,
  onSelectHistory,
  onSelectEnvironment,
  onSelectCollection,
  onSelectFolder,
}: Omit<CommandPaletteModalProps, 'isOpen'>) {
  const [query, setQuery] = useState('');
  const [rawSelectedIndex, setRawSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle global Escape key to close modal reliably from anywhere
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  // Index and prepare all searchable items from memory
  const allItems = useMemo(() => {
    const allRequestItems: RequestPaletteItem[] = [];
    const allFolderItems: FolderPaletteItem[] = [];

    for (const col of collections) {
      // 1. Root requests in collection
      if (col.requests) {
        for (const req of col.requests) {
          allRequestItems.push({
            type: 'request',
            id: `req-${req.id}`,
            title: req.name,
            subtitle: `${col.name} · ${req.request.url || 'No URL'}`,
            method: req.request.method,
            url: req.request.url,
            collectionName: col.name,
            breadcrumb: col.name,
            matchText: `${req.name} ${req.request.method} ${req.request.url} ${col.name}`,
            data: req,
          });
        }
      }

      // 2. Folders and nested requests
      if (col.folders && col.folders.length > 0) {
        const extracted = extractFolderAndRequestItems(col.folders, col, col.name);
        allFolderItems.push(...extracted.folderItems);
        allRequestItems.push(...extracted.requestItems);
      }
    }

    const collectionItems: CollectionPaletteItem[] = collections.map((col) => {
      const totalCount = countTotalRequestsInCollection(col);
      return {
        type: 'collection',
        id: `col-${col.id}`,
        title: col.name,
        subtitle: `${totalCount} request${totalCount === 1 ? '' : 's'} · ${col.folders.length} folder${col.folders.length === 1 ? '' : 's'}`,
        requestCount: totalCount,
        matchText: `${col.name} collection ${col.requests.map((r) => r.name).join(' ')}`,
        data: col,
      };
    });

    const environmentItems: EnvironmentPaletteItem[] = environments.map((env) => ({
      type: 'environment',
      id: `env-${env.id}`,
      title: env.name,
      subtitle: `${env.variables.length} variable${env.variables.length === 1 ? '' : 's'}${
        env.id === activeEnvironmentId ? ' (Active)' : ''
      }`,
      isActive: env.id === activeEnvironmentId,
      matchText: `${env.name} environment ${env.variables.map((v) => v.name).join(' ')}`,
      data: env,
    }));

    const historyItems: HistoryPaletteItem[] = history.map((item) => ({
      type: 'history',
      id: `hist-${item.id}`,
      title: item.url || '(empty URL)',
      subtitle: `${item.status} ${item.statusText || ''} · ${item.latency}ms`,
      method: item.method,
      status: item.status,
      latency: item.latency,
      timestamp: item.timestamp,
      url: item.url,
      matchText: `${item.method} ${item.url} ${item.status} ${item.statusText || ''} history`,
      data: item,
    }));

    return {
      requests: allRequestItems,
      folders: allFolderItems,
      collections: collectionItems,
      environments: environmentItems,
      history: historyItems,
    };
  }, [collections, environments, history, activeEnvironmentId]);

  // Filter items based on user search query
  const filteredGroups = useMemo<Array<{ key: string; label: string; items: PaletteItem[] }>>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return [
        { key: 'requests', label: 'Saved Requests', items: allItems.requests },
        { key: 'folders', label: 'Folders', items: allItems.folders },
        { key: 'collections', label: 'Collections', items: allItems.collections },
        { key: 'environments', label: 'Environments', items: allItems.environments },
        { key: 'history', label: 'Request History', items: allItems.history },
      ].filter((g) => g.items.length > 0);
    }

    const terms = trimmed.split(/\s+/).filter(Boolean);
    const matchesTerms = (text: string) => {
      const lower = text.toLowerCase();
      return terms.every((t) => lower.includes(t));
    };

    const matchingRequests = allItems.requests.filter((item) => matchesTerms(item.matchText));
    const matchingFolders = allItems.folders.filter((item) => matchesTerms(item.matchText));
    const matchingCollections = allItems.collections.filter((item) => matchesTerms(item.matchText));
    const matchingEnvironments = allItems.environments.filter((item) => matchesTerms(item.matchText));
    const matchingHistory = allItems.history.filter((item) => matchesTerms(item.matchText));

    return [
      { key: 'requests', label: 'Saved Requests', items: matchingRequests },
      { key: 'folders', label: 'Folders', items: matchingFolders },
      { key: 'collections', label: 'Collections', items: matchingCollections },
      { key: 'environments', label: 'Environments', items: matchingEnvironments },
      { key: 'history', label: 'Request History', items: matchingHistory },
    ].filter((g) => g.items.length > 0);
  }, [query, allItems]);

  // Flattened results for linear keyboard navigation
  const flattenedItems: PaletteItem[] = useMemo(() => {
    return filteredGroups.flatMap((g) => g.items);
  }, [filteredGroups]);

  // Derive safe clamped index without requiring synchronous setState in effect
  const selectedIndex = flattenedItems.length > 0
    ? Math.min(Math.max(0, rawSelectedIndex), flattenedItems.length - 1)
    : 0;

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElem = listRef.current.querySelector(`[data-palette-index="${selectedIndex}"]`);
    if (selectedElem) {
      selectedElem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelectItem = (item: PaletteItem) => {
    if (!item) return;

    if (item.type === 'request') {
      onSelectSavedRequest(item.data);
    } else if (item.type === 'folder') {
      onSelectFolder?.(item.data.folder, item.data.collection);
    } else if (item.type === 'history') {
      onSelectHistory(item.data);
    } else if (item.type === 'environment') {
      onSelectEnvironment(item.data.id);
    } else if (item.type === 'collection') {
      onSelectCollection?.(item.data);
    }

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flattenedItems.length > 0) {
        setRawSelectedIndex((prev) => (prev + 1) % flattenedItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flattenedItems.length > 0) {
        setRawSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flattenedItems.length > 0 && flattenedItems[selectedIndex]) {
        handleSelectItem(flattenedItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-24 bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center space-x-3 bg-slate-900/90 shrink-0">
          <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setRawSelectedIndex(0);
            }}
            placeholder="Search requests, collections, environments, or history..."
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs font-medium focus:outline-none"
          />
          <div className="flex items-center space-x-1.5 shrink-0">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setRawSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search input"
                title="Clear search input"
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              title="Close search (Esc)"
              className="text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 p-1 rounded-lg transition cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-3">
          {flattenedItems.length === 0 ? (
            <div className="py-10 text-center px-4">
              <svg className="w-7 h-7 mx-auto mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-slate-300">No matching items found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Try searching for a request name, HTTP method, URL, collection, or environment.
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.key} className="space-y-1">
                {/* Group Label */}
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {group.label}
                  </span>
                  <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full">
                    {group.items.length}
                  </span>
                </div>

                {/* Group Items */}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const itemIndex = runningIndex++;
                    const isSelected = itemIndex === selectedIndex;

                    return (
                      <div
                        key={item.id}
                        data-palette-index={itemIndex}
                        onClick={() => handleSelectItem(item)}
                        onMouseEnter={() => setRawSelectedIndex(itemIndex)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition text-xs ${
                          isSelected
                            ? 'bg-slate-800 text-slate-100 ring-1 ring-indigo-500/50 shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        {/* Item Icon & Details */}
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          {/* Left Type Icon / Badge */}
                          {item.type === 'request' && (
                            <span
                              className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0 ${getMethodBadgeColor(
                                item.method
                              )}`}
                            >
                              {item.method}
                            </span>
                          )}

                          {item.type === 'folder' && (
                            <div className="w-5 h-5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </div>
                          )}

                          {item.type === 'collection' && (
                            <div className="w-5 h-5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                          )}

                          {item.type === 'environment' && (
                            <div className="w-5 h-5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                          )}

                          {item.type === 'history' && (
                            <div className="flex items-center space-x-1 shrink-0">
                              <span
                                className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border ${getMethodBadgeColor(
                                  item.method
                                )}`}
                              >
                                {item.method}
                              </span>
                              <span
                                className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded ${getStatusBadgeColor(
                                  item.status
                                )}`}
                              >
                                {item.status}
                              </span>
                            </div>
                          )}

                          {/* Title & Subtitle */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`font-semibold truncate ${isSelected ? 'text-indigo-200' : 'text-slate-200'}`}>
                                {item.title}
                              </span>
                              {item.type === 'request' && (
                                <span className="text-[10px] text-slate-500 font-normal shrink-0">
                                  in {item.collectionName}
                                </span>
                              )}
                              {item.type === 'environment' && item.isActive && (
                                <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono font-semibold">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Right Selection / Hint Indicator */}
                        {isSelected && (
                          <div className="flex items-center space-x-1 text-slate-400 text-[10px] shrink-0 ml-2">
                            <span>Open</span>
                            <kbd className="bg-slate-900 border border-slate-700 px-1 py-0.2 rounded text-[9px] font-mono text-slate-300">
                              ↵
                            </kbd>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="border-t border-slate-800 bg-slate-950/60 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-slate-500 shrink-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center space-x-1">
              <kbd className="bg-slate-850 border border-slate-750 px-1 py-0.2 rounded text-[9px] font-mono text-slate-400">↑</kbd>
              <kbd className="bg-slate-850 border border-slate-750 px-1 py-0.2 rounded text-[9px] font-mono text-slate-400">↓</kbd>
              <span>Navigate</span>
            </span>
            <span>·</span>
            <span className="flex items-center space-x-1">
              <kbd className="bg-slate-850 border border-slate-750 px-1 py-0.2 rounded text-[9px] font-mono text-slate-400">Enter</kbd>
              <span>Open</span>
            </span>
            <span>·</span>
            <span className="flex items-center space-x-1">
              <kbd className="bg-slate-850 border border-slate-750 px-1 py-0.2 rounded text-[9px] font-mono text-slate-400">Esc</kbd>
              <span>Close</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 font-mono text-[9px] text-slate-550">
            <span>APIForge Workspace Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommandPaletteModal(props: CommandPaletteModalProps) {
  if (!props.isOpen) return null;
  return <CommandPaletteModalContent {...props} />;
}
