import { useState } from 'react';
import type { HttpMethod, KeyValueEntry } from '../types/request';

interface RequestEditorProps {
  method: HttpMethod;
  setMethod: (method: HttpMethod) => void;
  url: string;
  setUrl: (url: string) => void;
  queryParams: KeyValueEntry[];
  setQueryParams: (queryParams: KeyValueEntry[]) => void;
  onSend: () => void;
  isSending: boolean;
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export default function RequestEditor({
  method,
  setMethod,
  url,
  setUrl,
  queryParams,
  setQueryParams,
  onSend,
  isSending,
}: RequestEditorProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  const handleAddParam = () => {
    const newParam: KeyValueEntry = {
      id: generateId(),
      key: '',
      value: '',
      enabled: true,
      description: '',
    };
    setQueryParams([...queryParams, newParam]);
  };

  const handleToggleParam = (id: string, enabled: boolean) => {
    setQueryParams(
      queryParams.map((param) =>
        param.id === id ? { ...param, enabled } : param
      )
    );
  };

  const handleUpdateParam = (id: string, field: 'key' | 'value' | 'description', value: string) => {
    setQueryParams(
      queryParams.map((param) =>
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const handleDeleteParam = (id: string) => {
    setQueryParams(queryParams.filter((param) => param.id !== id));
  };

  const getMethodColor = (m: string) => {
    switch (m) {
      case 'GET': return 'text-emerald-400 border-emerald-500/20';
      case 'POST': return 'text-sky-400 border-sky-500/20';
      case 'PUT': return 'text-amber-400 border-amber-500/20';
      case 'DELETE': return 'text-rose-400 border-rose-500/20';
      case 'PATCH': return 'text-indigo-400 border-indigo-500/20';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col space-y-4">
      {/* Top Request Composer */}
      <div className="flex items-center space-x-2">
        {/* Method Selector Dropdown */}
        <div className="relative">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className={`bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none pr-8 ${getMethodColor(method)}`}
          >
            {methods.map((m) => (
              <option key={m} value={m} className={getMethodColor(m)}>
                {m}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <svg className="fill-current h-3 w-3" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>

        {/* URL Input field */}
        <div className="flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter request URL (e.g. http://localhost:3001/api/health)"
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 rounded-lg px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/35 transition"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={isSending}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white font-semibold text-xs py-2 px-5 rounded-lg shadow-lg shadow-indigo-650/15 hover:shadow-indigo-500/25 transition duration-200 flex items-center space-x-1.5"
        >
          {isSending ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <svg className="w-3 h-3 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Tabs list */}
      <div>
        <div className="flex border-b border-slate-800 text-xs font-semibold text-slate-400">
          {(['params', 'headers', 'body', 'auth'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 capitalize transition relative ${activeTab === tab ? 'text-indigo-400 font-bold' : 'hover:text-slate-200'}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content placeholder boxes */}
        <div className="py-4 min-h-[140px] text-xs">
          {activeTab === 'params' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Query Parameters</span>
                <button
                  type="button"
                  onClick={handleAddParam}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1.5 transition duration-150 active:scale-95"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Parameter</span>
                </button>
              </div>

              {queryParams.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg text-slate-500 select-none">
                  No query parameters defined. Click "Add Parameter" to start.
                </div>
              ) : (
                <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/20">
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-850 p-2 bg-slate-900/20 text-[10px] font-bold uppercase tracking-wider text-slate-450 font-mono">
                    <div className="col-span-1 text-center">Active</div>
                    <div className="col-span-3">Key</div>
                    <div className="col-span-3">Value</div>
                    <div className="col-span-4">Description</div>
                    <div className="col-span-1 text-center">Delete</div>
                  </div>
                  
                  <div className="divide-y divide-slate-850/80">
                    {queryParams.map((param) => (
                      <div
                        key={param.id}
                        className={`grid grid-cols-12 gap-2 items-center p-2 hover:bg-slate-900/10 transition duration-150 ${
                          !param.enabled ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Enabled Switch */}
                        <div className="col-span-1 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={param.enabled}
                            onChange={(e) => handleToggleParam(param.id, e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-800 text-indigo-600 bg-slate-950 focus:ring-indigo-500/30 cursor-pointer focus:ring-offset-0 focus:outline-none"
                          />
                        </div>
                        
                        {/* Key Input */}
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={param.key}
                            onChange={(e) => handleUpdateParam(param.id, 'key', e.target.value)}
                            placeholder="Key"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-300 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        {/* Value Input */}
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={param.value}
                            onChange={(e) => handleUpdateParam(param.id, 'value', e.target.value)}
                            placeholder="Value"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-300 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        {/* Description Input */}
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={param.description || ''}
                            onChange={(e) => handleUpdateParam(param.id, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-350 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        {/* Delete Action */}
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteParam(param.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition duration-150 hover:bg-rose-950/20 active:scale-95"
                            title="Delete Parameter"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Request Headers</span>
              <div className="space-y-1 bg-slate-950/40 border border-slate-800/80 rounded-lg p-3">
                <div className="flex items-center justify-between text-slate-450 font-mono text-[11px] pb-1 border-b border-slate-900 mb-1">
                  <span>Header</span>
                  <span>Value</span>
                </div>
                <div className="flex items-center justify-between font-mono text-slate-400 py-0.5">
                  <span className="text-indigo-400">Content-Type</span>
                  <span className="text-slate-300">application/json</span>
                </div>
                <div className="flex items-center justify-between font-mono text-slate-400 py-0.5">
                  <span className="text-indigo-400">Accept</span>
                  <span className="text-slate-300">*/*</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'body' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Request Body</span>
                <div className="flex space-x-2 text-[10px] text-slate-450 font-medium">
                  <span className="text-indigo-400 underline cursor-pointer">raw (JSON)</span>
                  <span>•</span>
                  <span className="cursor-not-allowed">form-data</span>
                  <span>•</span>
                  <span className="cursor-not-allowed">none</span>
                </div>
              </div>
              <textarea
                placeholder={`{\n  "key": "value"\n}`}
                className="w-full h-24 bg-slate-950 border border-slate-800/85 text-indigo-300 placeholder-slate-700 rounded-lg p-2.5 font-mono focus:outline-none focus:border-indigo-500 transition resize-none"
              />
            </div>
          )}

          {activeTab === 'auth' && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Authentication</span>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Type</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-slate-700 text-slate-300 font-medium">
                    <option>Bearer Token</option>
                    <option>API Key</option>
                    <option>No Auth</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Token</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
