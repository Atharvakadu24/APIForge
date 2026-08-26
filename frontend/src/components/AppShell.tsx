import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden text-slate-100">
      {/* Top Application Header */}
      <Header />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar (hidden on extra small screens, toggleable or scrollable) */}
        <div className="hidden sm:block">
          <Sidebar />
        </div>

        {/* Content Pane */}
        <main className="flex-1 flex flex-col p-4 overflow-y-auto min-w-0 bg-slate-950/40 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
