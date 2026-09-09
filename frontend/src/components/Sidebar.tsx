import React, { useState } from 'react';
import type { HistoryItem } from '../types/history';
import type { Collection, SavedRequest } from '../types/collection';

export interface SidebarProps {
  collections: Collection[];
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
}

export default function Sidebar({
  collections,
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
}: SidebarProps) {
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isExpanded = (id: string) => {
    return expandedCollections[id] !== false; // Expanded by default
  };

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

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-sm flex flex-col app-height select-none shrink-0 overflow-hidden">
      {/* New Request Button */}
      <div className="p-3">
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

      <div className="h-px bg-slate-850 mx-3" />

      {/* Main navigation / lists */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {/* Collections Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Collections</span>
              {collections.length > 0 && (
                <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full">
                  {collections.length}
                </span>
              )}
            </div>
            <button
              onClick={onOpenCreateCollection}
              className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800 p-1 rounded transition cursor-pointer"
              title="Create new collection"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="space-y-1">
            {collections.length === 0 ? (
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
              collections.map((col) => {
                const expanded = isExpanded(col.id);
                return (
                  <div key={col.id} className="space-y-0.5 group/col">
                    {/* Collection Header */}
                    <div
                      onClick={() => toggleCollection(col.id)}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-800/80 rounded-md cursor-pointer transition text-xs text-slate-300 font-medium"
                    >
                      <div className="flex items-center space-x-1.5 min-w-0">
                        {/* Expand/Collapse Chevron */}
                        <svg
                          className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${expanded ? 'transform rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        
                        {/* Folder Icon */}
                        <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>

                        <span className="truncate text-slate-200">{col.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({col.requests.length})</span>
                      </div>

                      {/* Collection Actions on Hover */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover/col:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRenameCollection(col);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 rounded transition"
                          title="Rename collection"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCollectionPrompt(col);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                          title="Delete collection"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Saved Requests under Collection */}
                    {expanded && (
                      <div className="pl-4 space-y-0.5 border-l border-slate-800/80 ml-3 my-0.5">
                        {col.requests.length === 0 ? (
                          <div className="px-2 py-1 text-[10px] text-slate-500 italic">
                            No requests in this collection
                          </div>
                        ) : (
                          col.requests.map((req) => {
                            const isSelected = activeSavedRequestId === req.id;
                            const method = req.request.method;
                            return (
                              <div
                                key={req.id}
                                onClick={() => onSelectSavedRequest(req)}
                                className={`group/req flex items-center justify-between px-2 py-1 rounded cursor-pointer transition text-[11px] ${
                                  isSelected
                                    ? 'bg-slate-800 text-indigo-300 font-medium ring-1 ring-indigo-500/40'
                                    : 'text-slate-350 hover:bg-slate-800/60 hover:text-slate-200'
                                }`}
                                title={req.request.url}
                              >
                                <div className="flex items-center space-x-2 truncate min-w-0">
                                  <span className={`text-[8px] font-bold font-mono px-1 py-0.2 rounded border shrink-0 ${getMethodBadgeColor(method)}`}>
                                    {method}
                                  </span>
                                  <span className="truncate">{req.name}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => onDeleteSavedRequest(col.id, req.id, e)}
                                  className="opacity-0 group-hover/req:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition shrink-0 ml-1"
                                  title="Delete saved request"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })
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
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">History</span>
              {history.length > 0 && (
                <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full">
                  {history.length}
                </span>
              )}
            </div>
            <button
              onClick={onClearHistory}
              disabled={history.length === 0}
              className={`text-[9px] font-semibold transition px-1.5 py-0.5 rounded ${
                history.length > 0
                  ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
              }`}
              title={history.length > 0 ? 'Clear all history' : 'History is empty'}
            >
              Clear
            </button>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
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
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectHistory(item)}
                    className={`group relative flex flex-col p-2 rounded-lg cursor-pointer transition border ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500/60 shadow-sm shadow-indigo-500/10'
                        : 'bg-slate-900/40 hover:bg-slate-850/80 border-slate-850/80 hover:border-slate-750'
                    }`}
                  >
                    {/* Top Row: Method, Status, Latency, Delete Button */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border ${getMethodBadgeColor(item.method)}`}>
                          {item.method}
                        </span>
                        <span className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded ${getStatusBadgeColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[9px] font-mono text-slate-500">
                          {formatLatency(item.latency)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => onDeleteHistoryItem(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition"
                          title="Delete history item"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Truncated URL & Timestamp */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-mono truncate max-w-[140px] ${
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
      <div className="p-3 border-t border-slate-850 text-[10px] text-slate-500 font-medium flex items-center justify-between">
        <span>Vite-TS Environment</span>
        <span className="text-[9px] text-slate-600 font-mono">v1.0</span>
      </div>
    </aside>
  );
}
