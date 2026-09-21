import { useState, useMemo } from 'react';
import type { ResponseData } from '../types/request';
import ResponseBodyViewer from './ResponseBodyViewer';
import ResponseHeaders from './ResponseHeaders';
import ResponseSearch from './ResponseSearch';
import { formatBytes, getStatusStyle, tryParseJson } from '../utils/responseUtils';

interface ResponsePanelProps {
  response: ResponseData | null;
  isSending: boolean;
}

export default function ResponsePanel({ response, isSending }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [isPretty, setIsPretty] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // Parse JSON structure once
  const responseBody = response?.body;
  const jsonInfo = useMemo(() => {
    if (!responseBody) return { isJson: false };
    return tryParseJson(responseBody);
  }, [responseBody]);

  // Headers count
  const headersCount = response?.headers ? Object.keys(response.headers).length : 0;

  // Copy entire response body
  const handleCopyBody = () => {
    if (!response?.body) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Search Navigation
  const handleNextMatch = () => {
    if (matchCount === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matchCount);
  };

  const handlePrevMatch = () => {
    if (matchCount === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setMatchCount(0);
    setActiveMatchIndex(0);
  };

  const handleToggleSearch = () => {
    if (isSearchOpen) {
      handleCloseSearch();
    } else {
      setIsSearchOpen(true);
    }
  };

  const statusStyle = response ? getStatusStyle(response.status) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col min-h-[260px] overflow-hidden">
      {/* Response Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-2 gap-2 select-none">
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <span>Response</span>
            {isSending && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            )}
          </h2>

          {/* Sub-tabs (Body / Headers) */}
          {response && (
            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('body')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'body'
                    ? 'bg-slate-800 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Body</span>
                {jsonInfo.isJson && (
                  <span className="text-[9px] font-mono text-indigo-350 bg-indigo-950/80 px-1 rounded border border-indigo-800/40">
                    JSON
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('headers')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'headers'
                    ? 'bg-slate-800 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Headers</span>
                {headersCount > 0 && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded-full border border-slate-800">
                    {headersCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Pretty / Raw Mode Toggle (Visible when Body tab is active and response is JSON) */}
          {response && activeTab === 'body' && jsonInfo.isJson && (
            <div className="flex items-center space-x-0.5 bg-slate-950 border border-slate-800 rounded-md p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setIsPretty(true)}
                className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                  isPretty
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pretty
              </button>
              <button
                type="button"
                onClick={() => setIsPretty(false)}
                className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                  !isPretty
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Raw
              </button>
            </div>
          )}
        </div>

        {/* Response Metrics & Controls */}
        {response && (
          <div className="flex items-center space-x-2 text-[11px] font-mono flex-wrap gap-y-1">
            {/* Search Trigger Button */}
            {activeTab === 'body' && (
              <button
                type="button"
                onClick={handleToggleSearch}
                className={`px-2 py-0.5 rounded border text-xs transition cursor-pointer flex items-center space-x-1 ${
                  isSearchOpen
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-850 hover:bg-slate-850'
                }`}
                title="Search response body"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Find</span>
              </button>
            )}

            {/* Status badge */}
            <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded border ${statusStyle?.bgClass} ${statusStyle?.borderClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle?.dotClass}`} />
              <span className={`${statusStyle?.textClass} font-bold`}>
                {response.status} {response.statusText}
              </span>
            </div>

            {/* Latency */}
            <div className="flex items-center space-x-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-400">
              <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-amber-400 font-medium">{response.time} ms</span>
            </div>

            {/* Response Size */}
            <div className="flex items-center space-x-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-400">
              <span className="text-sky-400 font-medium">{formatBytes(response.size)}</span>
            </div>

            {/* Copy Body Button */}
            {response.body && (
              <button
                type="button"
                onClick={handleCopyBody}
                className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 px-2 py-0.5 rounded transition cursor-pointer active:scale-95 flex items-center space-x-1"
                title="Copy full response body"
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Embedded Search Control Bar */}
      {response && isSearchOpen && activeTab === 'body' && (
        <div className="mb-2">
          <ResponseSearch
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setActiveMatchIndex(0);
            }}
            matchCount={matchCount}
            activeMatchIndex={activeMatchIndex}
            onNextMatch={handleNextMatch}
            onPrevMatch={handlePrevMatch}
            onClose={handleCloseSearch}
          />
        </div>
      )}

      {/* Response Content Inspector */}
      <div className="flex-1 flex flex-col justify-center overflow-auto min-h-0">
        {isSending ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-400 font-medium animate-pulse">Request in transit...</p>
          </div>
        ) : response ? (
          activeTab === 'body' ? (
            <ResponseBodyViewer
              rawBody={response.body}
              isPretty={isPretty}
              searchQuery={isSearchOpen ? searchQuery : ''}
              activeMatchIndex={activeMatchIndex}
              onMatchCountChange={setMatchCount}
            />
          ) : (
            <ResponseHeaders headers={response.headers} />
          )
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-slate-850/80 shadow-inner">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Send a request to see the response
              </p>
              <p className="text-[11px] text-slate-500 max-w-[280px] mt-1 mx-auto leading-relaxed">
                Configure your request parameters above and hit <span className="text-indigo-400 font-semibold">Send</span> to inspect response headers and body data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
