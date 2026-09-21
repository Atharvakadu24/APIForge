import React, { useEffect, useRef } from 'react';

interface ResponseSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  matchCount: number;
  activeMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClose: () => void;
}

export default function ResponseSearch({
  searchQuery,
  setSearchQuery,
  matchCount,
  activeMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClose,
}: ResponseSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus when mounted
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Keyboard navigation: Enter -> Next, Shift+Enter -> Prev, Esc -> Close
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-slate-950 border border-slate-750 px-2.5 py-1 rounded-lg text-xs shadow-md animate-fade-in">
      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in response... (Enter / Esc)"
        className="bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none w-44 font-mono text-xs"
      />

      {searchQuery && (
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded shrink-0">
          {matchCount > 0 ? `${activeMatchIndex + 1} of ${matchCount}` : '0 matches'}
        </span>
      )}

      {matchCount > 0 && (
        <div className="flex items-center space-x-0.5 shrink-0">
          <button
            type="button"
            onClick={onPrevMatch}
            title="Previous match (Shift+Enter)"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded transition cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNextMatch}
            title="Next match (Enter)"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded transition cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        title="Close search (Esc)"
        className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-850 rounded transition cursor-pointer"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
