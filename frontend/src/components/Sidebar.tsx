import React from 'react';
import type { HistoryItem } from '../types/history';

// Mock collections data for UI layout
const mockCollections = [
  {
    id: 1,
    name: 'User Management API',
    requests: [
      { id: 'u1', method: 'GET', name: 'Get Profile' },
      { id: 'u2', method: 'POST', name: 'Update Account' },
    ],
  },
  {
    id: 2,
    name: 'Billing Service',
    requests: [
      { id: 'b1', method: 'GET', name: 'Fetch Invoices' },
      { id: 'b2', method: 'POST', name: 'Create Subscription' },
    ],
  },
];

export interface SidebarProps {
  history: HistoryItem[];
  selectedHistoryId: string | null;
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string, e: React.MouseEvent) => void;
}

export default function Sidebar({
  history,
  selectedHistoryId,
  onSelectHistory,
  onClearHistory,
  onDeleteHistoryItem,
}: SidebarProps) {
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
        <button className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 shadow-md shadow-indigo-500/10 cursor-pointer">
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
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Collections</span>
            <button className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          <div className="space-y-1">
            {mockCollections.map((col) => (
              <div key={col.id} className="space-y-0.5">
                {/* Folder Header */}
                <div className="flex items-center space-x-1.5 px-2 py-1 hover:bg-slate-800/80 rounded-md cursor-pointer transition text-xs text-slate-300 font-medium">
                  <svg className="w-3.5 h-3.5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate">{col.name}</span>
                </div>

                {/* Sub Requests */}
                <div className="pl-6 space-y-0.5">
                  {col.requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center space-x-2 px-2 py-0.5 hover:bg-slate-800/60 rounded cursor-pointer transition text-[11px] text-slate-400 group"
                    >
                      <span className={`text-[8px] font-bold font-mono px-1 py-0.5 rounded border ${getMethodBadgeColor(req.method)}`}>
                        {req.method}
                      </span>
                      <span className="truncate group-hover:text-slate-300">{req.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

          <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
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
