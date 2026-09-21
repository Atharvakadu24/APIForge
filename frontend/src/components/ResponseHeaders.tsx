import { useState, useMemo } from 'react';

interface ResponseHeadersProps {
  headers?: Record<string, string>;
}

export default function ResponseHeaders({ headers }: ResponseHeadersProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const headerEntries = useMemo(() => {
    if (!headers) return [];
    return Object.entries(headers);
  }, [headers]);

  const filteredEntries = useMemo(() => {
    if (!filterQuery.trim()) return headerEntries;
    const q = filterQuery.toLowerCase();
    return headerEntries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    );
  }, [headerEntries, filterQuery]);

  const handleCopyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  const handleCopyAll = () => {
    if (headerEntries.length === 0) return;
    const text = headerEntries.map(([k, v]) => `${k}: ${v}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => {
      setCopiedAll(false);
    }, 1800);
  };

  if (headerEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 text-xs">
        <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>No response headers captured.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 h-full overflow-hidden">
      {/* Headers Filter & Copy All Bar */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter headers..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-slate-500">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'header' : 'headers'}
          </span>
          <button
            type="button"
            onClick={handleCopyAll}
            className="bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center space-x-1"
            title="Copy all headers"
          >
            {copiedAll ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-400 font-semibold">Copied All</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Copy All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Two-column Headers Table */}
      <div className="flex-1 bg-slate-950 rounded-lg border border-slate-850 overflow-auto divide-y divide-slate-850/80 font-mono text-xs">
        {filteredEntries.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            No headers match "{filterQuery}".
          </div>
        ) : (
          filteredEntries.map(([key, val]) => (
            <div
              key={key}
              className="group flex items-start justify-between py-2 px-3 hover:bg-slate-900/60 transition gap-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 flex-1 min-w-0">
                <span className="text-indigo-400 font-semibold shrink-0 sm:w-48 break-words select-text">
                  {key}
                </span>
                <span className="text-slate-300 break-all select-text font-normal leading-relaxed">
                  {val}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyValue(key, val)}
                className="opacity-0 group-hover:opacity-100 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-750 px-1.5 py-0.5 rounded text-[11px] transition cursor-pointer shrink-0"
                title={`Copy value of ${key}`}
              >
                {copiedKey === key ? (
                  <span className="text-emerald-400 flex items-center space-x-1 font-semibold">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied</span>
                  </span>
                ) : (
                  <span>Copy</span>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
