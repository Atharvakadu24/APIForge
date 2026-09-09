import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import type { HistoryItem } from '../types/history';

interface AppShellProps {
  children: React.ReactNode;
  history: HistoryItem[];
  selectedHistoryId: string | null;
  onSelectHistory: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string, e: React.MouseEvent) => void;
}

export default function AppShell({
  children,
  history,
  selectedHistoryId,
  onSelectHistory,
  onClearHistory,
  onDeleteHistoryItem,
}: AppShellProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden text-slate-100">
      {/* Top Application Header */}
      <Header />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar (hidden on extra small screens, toggleable or scrollable) */}
        <div className="hidden sm:block">
          <Sidebar
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
