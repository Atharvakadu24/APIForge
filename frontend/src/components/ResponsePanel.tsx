import { useState } from 'react';
import type { ResponseData } from '../types/request';

interface ResponsePanelProps {
  response: ResponseData | null;
  isSending: boolean;
}

export default function ResponsePanel({ response, isSending }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [copied, setCopied] = useState(false);

  const formatBody = (rawBody: string) => {
    if (!rawBody || !rawBody.trim()) return '(empty response body)';
    try {
      const parsed = JSON.parse(rawBody);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return rawBody;
    }
  };

  const handleCopy = () => {
    if (!response?.body) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const responseHeadersEntries = response?.headers ? Object.entries(response.headers) : [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col min-h-[240px] overflow-hidden">
      {/* Response Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2 select-none">
        <div className="flex items-center space-x-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <span>Response</span>
            {isSending && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            )}
          </h2>

          {/* Response Sub-tabs */}
          {response && (
            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('body')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  activeTab === 'body'
                    ? 'bg-slate-800 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Body
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('headers')}
                className={`px-2.5 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  activeTab === 'headers'
                    ? 'bg-slate-800 text-indigo-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Headers</span>
                {responseHeadersEntries.length > 0 && (
                  <span className="text-[10px] font-mono text-slate-500">
                    ({responseHeadersEntries.length})
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Response Metrics & Actions */}
        {response && (
          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className="text-slate-500">Status:</span>
              <span
                className={
                  response.status >= 200 && response.status < 300
                    ? 'text-emerald-400 font-bold'
                    : response.status >= 400
                    ? 'text-rose-450 font-bold'
                    : 'text-amber-400 font-bold'
                }
              >
                {response.status} {response.statusText}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className="text-slate-500">Time:</span>
              <span className="text-amber-400 font-medium">{response.time}ms</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className="text-slate-500">Size:</span>
              <span className="text-sky-400 font-medium">
                {response.size > 1024
                  ? `${(response.size / 1024).toFixed(1)} KB`
                  : `${response.size} B`}
              </span>
            </div>

            {/* Copy button */}
            {response.body && (
              <button
                type="button"
                onClick={handleCopy}
                className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-850 px-2 py-0.5 rounded transition cursor-pointer active:scale-95"
                title="Copy response body"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Response Body & Headers Inspector */}
      <div className="flex-1 flex flex-col justify-center overflow-auto min-h-0">
        {isSending ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium animate-pulse">Request in transit...</p>
          </div>
        ) : response ? (
          activeTab === 'body' ? (
            <div className="flex-1 bg-slate-950 rounded-lg border border-slate-850 p-3 font-mono text-xs text-indigo-350 overflow-auto max-h-[350px]">
              <pre className="text-left whitespace-pre-wrap select-text leading-relaxed">
                {formatBody(response.body)}
              </pre>
            </div>
          ) : (
            <div className="flex-1 bg-slate-950 rounded-lg border border-slate-850 p-3 font-mono text-xs overflow-auto max-h-[350px]">
              {responseHeadersEntries.length === 0 ? (
                <p className="text-slate-500">No response headers captured.</p>
              ) : (
                <div className="divide-y divide-slate-850/80">
                  {responseHeadersEntries.map(([key, val]) => (
                    <div key={key} className="py-1.5 flex items-start space-x-2 text-[11px]">
                      <span className="text-indigo-400 font-semibold shrink-0 min-w-[140px]">{key}:</span>
                      <span className="text-slate-300 break-all">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-slate-850/80">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400">
                Send a request to see the response
              </p>
              <p className="text-[11px] text-slate-650 max-w-[280px] mt-1 mx-auto">
                Select an HTTP method, type a URL address above, and hit the Send button.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
