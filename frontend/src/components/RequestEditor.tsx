import { useState } from 'react';
import type { HttpMethod, KeyValueEntry, RequestAuth, RequestBodyType, AuthType } from '../types/request';

interface RequestEditorProps {
  method: HttpMethod;
  setMethod: (method: HttpMethod) => void;
  url: string;
  setUrl: (url: string) => void;
  queryParams: KeyValueEntry[];
  setQueryParams: (queryParams: KeyValueEntry[]) => void;
  headers: KeyValueEntry[];
  setHeaders: (headers: KeyValueEntry[]) => void;
  bodyType: RequestBodyType;
  setBodyType: (bodyType: RequestBodyType) => void;
  body: string;
  setBody: (body: string) => void;
  auth: RequestAuth;
  setAuth: (auth: RequestAuth) => void;
  onSend: () => void;
  isSending: boolean;
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

const COMMON_HEADERS = [
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'Host',
  'Origin',
  'Pragma',
  'Referer',
  'User-Agent',
];

const COMMON_HEADER_VALUES = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'text/html',
  'text/plain',
  'multipart/form-data',
  '*/*',
  'no-cache',
  'no-store',
  'keep-alive',
];

export default function RequestEditor({
  method,
  setMethod,
  url,
  setUrl,
  queryParams,
  setQueryParams,
  headers,
  setHeaders,
  bodyType,
  setBodyType,
  body,
  setBody,
  auth,
  setAuth,
  onSend,
  isSending,
}: RequestEditorProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);

  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  // Params handlers
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

  // Headers handlers
  const handleAddHeader = () => {
    const newHeader: KeyValueEntry = {
      id: generateId(),
      key: '',
      value: '',
      enabled: true,
      description: '',
    };
    setHeaders([...headers, newHeader]);
  };

  const handleToggleHeader = (id: string, enabled: boolean) => {
    setHeaders(
      headers.map((header) =>
        header.id === id ? { ...header, enabled } : header
      )
    );
  };

  const handleUpdateHeader = (id: string, field: 'key' | 'value' | 'description', value: string) => {
    setHeaders(
      headers.map((header) =>
        header.id === id ? { ...header, [field]: value } : header
      )
    );
  };

  const handleDeleteHeader = (id: string) => {
    setHeaders(headers.filter((header) => header.id !== id));
  };

  // Body JSON Validation & Formatting
  const getJsonValidation = () => {
    if (!body.trim()) return { isValid: true, error: null, isEmpty: true };
    try {
      JSON.parse(body);
      return { isValid: true, error: null, isEmpty: false };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid JSON syntax';
      return { isValid: false, error: errorMsg, isEmpty: false };
    }
  };

  const jsonValidation = getJsonValidation();

  const handleFormatJson = () => {
    if (!body.trim()) return;
    try {
      const parsed = JSON.parse(body);
      setBody(JSON.stringify(parsed, null, 2));
    } catch {
      // If invalid, keep existing text
    }
  };

  const handleClearBody = () => {
    setBody('');
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      setBody(newVal);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Auth Handlers
  const handleAuthTypeChange = (type: AuthType) => {
    if (type === 'none') {
      setAuth({ type: 'none' });
    } else if (type === 'bearer') {
      setAuth({
        type: 'bearer',
        bearer: {
          token: auth.bearer?.token || '',
        },
      });
    } else if (type === 'apiKey') {
      setAuth({
        type: 'apiKey',
        apiKey: {
          key: auth.apiKey?.key || '',
          value: auth.apiKey?.value || '',
          addTo: auth.apiKey?.addTo || 'header',
        },
      });
    }
  };

  const handleBearerTokenChange = (token: string) => {
    setAuth({
      ...auth,
      type: 'bearer',
      bearer: { token },
    });
  };

  const handleApiKeyChange = (field: 'key' | 'value' | 'addTo', value: string) => {
    const current = auth.apiKey || { key: '', value: '', addTo: 'header' };
    setAuth({
      ...auth,
      type: 'apiKey',
      apiKey: {
        ...current,
        [field]: value,
      },
    });
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

  const activeParamsCount = queryParams.filter((p) => p.enabled && p.key.trim()).length;
  const activeHeadersCount = headers.filter((h) => h.enabled && h.key.trim()).length;
  const hasBody = bodyType !== 'none' && body.trim().length > 0;
  const hasAuth = auth.type !== 'none';

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
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white font-semibold text-xs py-2 px-5 rounded-lg shadow-lg shadow-indigo-650/15 hover:shadow-indigo-500/25 transition duration-200 flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
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
          {(
            [
              { id: 'params', label: 'Params', badge: activeParamsCount > 0 ? activeParamsCount : null },
              { id: 'headers', label: 'Headers', badge: activeHeadersCount > 0 ? activeHeadersCount : null },
              { id: 'body', label: 'Body', dot: hasBody },
              { id: 'auth', label: 'Auth', dot: hasAuth },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 capitalize transition relative flex items-center space-x-1.5 cursor-pointer ${
                activeTab === tab.id ? 'text-indigo-400 font-bold' : 'hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {'badge' in tab && tab.badge !== null && (
                <span className="bg-slate-800 text-indigo-350 text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-slate-700">
                  {tab.badge}
                </span>
              )}
              {'dot' in tab && tab.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="py-4 min-h-[160px] text-xs">
          {/* PARAMS TAB */}
          {activeTab === 'params' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Query Parameters</span>
                <button
                  type="button"
                  onClick={handleAddParam}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1.5 transition duration-150 active:scale-95 cursor-pointer"
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
                        <div className="col-span-1 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={param.enabled}
                            onChange={(e) => handleToggleParam(param.id, e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-800 text-indigo-600 bg-slate-950 focus:ring-indigo-500/30 cursor-pointer focus:ring-offset-0 focus:outline-none"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={param.key}
                            onChange={(e) => handleUpdateParam(param.id, 'key', e.target.value)}
                            placeholder="Key"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-300 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={param.value}
                            onChange={(e) => handleUpdateParam(param.id, 'value', e.target.value)}
                            placeholder="Value"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-300 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={param.description || ''}
                            onChange={(e) => handleUpdateParam(param.id, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-350 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteParam(param.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition duration-150 hover:bg-rose-950/20 active:scale-95 cursor-pointer"
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

          {/* HEADERS TAB */}
          {activeTab === 'headers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Request Headers</span>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1.5 transition duration-150 active:scale-95 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Header</span>
                </button>
              </div>

              {headers.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg text-slate-500 select-none">
                  No headers defined. Click "Add Header" to start.
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
                    {headers.map((header) => (
                      <div
                        key={header.id}
                        className={`grid grid-cols-12 gap-2 items-center p-2 hover:bg-slate-900/10 transition duration-150 ${
                          !header.enabled ? 'opacity-55' : ''
                        }`}
                      >
                        <div className="col-span-1 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={header.enabled}
                            onChange={(e) => handleToggleHeader(header.id, e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-800 text-indigo-600 bg-slate-950 focus:ring-indigo-500/30 cursor-pointer focus:ring-offset-0 focus:outline-none"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) => handleUpdateHeader(header.id, 'key', e.target.value)}
                            placeholder="Key"
                            list="common-headers"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-300 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={header.value}
                            onChange={(e) => handleUpdateHeader(header.id, 'value', e.target.value)}
                            placeholder="Value"
                            list="common-header-values"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-300 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={header.description || ''}
                            onChange={(e) => handleUpdateHeader(header.id, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full bg-slate-950 border border-slate-850/85 rounded px-2 py-1 text-slate-350 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 transition"
                          />
                        </div>
                        
                        <div className="col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteHeader(header.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition duration-150 hover:bg-rose-950/20 active:scale-95 cursor-pointer"
                            title="Delete Header"
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

          {/* BODY TAB */}
          {activeTab === 'body' && (
            <div className="space-y-3">
              {/* Header bar: Body Type Selector + Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                  {(
                    [
                      { id: 'none', label: 'None' },
                      { id: 'json', label: 'JSON' },
                      { id: 'text', label: 'Text' },
                    ] as const
                  ).map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setBodyType(type.id)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        bodyType === type.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {/* Body Actions & Validation Indicator */}
                {bodyType !== 'none' && (
                  <div className="flex items-center space-x-2">
                    {/* JSON live status indicator */}
                    {bodyType === 'json' && !jsonValidation.isEmpty && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium flex items-center space-x-1 border ${
                          jsonValidation.isValid
                            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-950/50 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {jsonValidation.isValid ? (
                          <>
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Valid JSON</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Invalid JSON</span>
                          </>
                        )}
                      </span>
                    )}

                    {/* Prettify Action (JSON mode) */}
                    {bodyType === 'json' && (
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        disabled={!body.trim() || !jsonValidation.isValid}
                        className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 text-indigo-300 hover:text-indigo-200 border border-slate-800 rounded px-2.5 py-1 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                        title="Format JSON with 2 spaces"
                      >
                        <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                        </svg>
                        <span>Prettify</span>
                      </button>
                    )}

                    {/* Clear Button */}
                    {body.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearBody}
                        className="text-slate-500 hover:text-rose-400 bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/50 rounded px-2 py-1 text-xs transition active:scale-95 cursor-pointer"
                        title="Clear body content"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Body Content Area */}
              {bodyType === 'none' ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed border-slate-850 rounded-lg bg-slate-950/20 select-none">
                  <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-400">This request does not have a body</p>
                  <p className="text-[11px] text-slate-600 max-w-sm">
                    Select <span className="text-indigo-400 font-mono">JSON</span> or <span className="text-indigo-400 font-mono">Text</span> above to attach a payload.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder={
                        bodyType === 'json'
                          ? '{\n  "key": "value",\n  "enabled": true\n}'
                          : 'Enter raw text payload here...'
                      }
                      rows={8}
                      className={`w-full bg-slate-950 border font-mono text-xs text-slate-200 placeholder-slate-700 rounded-lg p-3 leading-relaxed focus:outline-none transition resize-y min-h-[140px] max-h-[400px] ${
                        bodyType === 'json' && !jsonValidation.isValid && !jsonValidation.isEmpty
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
                          : 'border-slate-800/90 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'
                      }`}
                      spellCheck={false}
                    />
                  </div>

                  {/* JSON Syntax Error Banner */}
                  {bodyType === 'json' && !jsonValidation.isValid && !jsonValidation.isEmpty && jsonValidation.error && (
                    <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2 text-rose-300 text-xs flex items-start space-x-2 font-mono">
                      <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 overflow-x-auto">
                        <span className="font-semibold text-rose-400">JSON Parse Error: </span>
                        <span className="text-[11px] text-rose-200/90">{jsonValidation.error}</span>
                      </div>
                    </div>
                  )}

                  {/* Character/Info bar */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono px-1">
                    <span>
                      {bodyType === 'json' ? 'Content-Type: application/json' : 'Content-Type: text/plain'}
                    </span>
                    <span>
                      {body.length} characters {body.length > 0 && `• ${body.split('\n').length} lines`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUTH TAB */}
          {activeTab === 'auth' && (
            <div className="space-y-4">
              {/* Auth Type Selector */}
              <div className="flex items-center space-x-3 pb-1 border-b border-slate-850">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Type:</span>
                <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                  {(
                    [
                      { id: 'none', label: 'No Auth' },
                      { id: 'bearer', label: 'Bearer Token' },
                      { id: 'apiKey', label: 'API Key' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAuthTypeChange(item.id)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        auth.type === item.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* No Auth State */}
              {auth.type === 'none' && (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed border-slate-850 rounded-lg bg-slate-950/20 select-none">
                  <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-400">No Authentication Configured</p>
                  <p className="text-[11px] text-slate-600 max-w-sm">
                    This request will be sent without any authorization headers or query authentication parameters.
                  </p>
                </div>
              )}

              {/* Bearer Token Form */}
              {auth.type === 'bearer' && (
                <div className="space-y-3 bg-slate-950/30 border border-slate-850 rounded-xl p-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      Bearer Token
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 px-2 py-0.5 bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-[11px] rounded pointer-events-none select-none font-semibold">
                        Bearer
                      </span>
                      <input
                        type={showBearerToken ? 'text' : 'password'}
                        value={auth.bearer?.token || ''}
                        onChange={(e) => handleBearerTokenChange(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-20 pr-10 py-2 text-slate-200 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBearerToken(!showBearerToken)}
                        className="absolute right-2.5 text-slate-500 hover:text-slate-300 p-1 transition cursor-pointer"
                        title={showBearerToken ? 'Hide token' : 'Show token'}
                      >
                        {showBearerToken ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Header preview helper */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-lg p-2.5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-indigo-400 font-semibold">Header Preview:</span>
                      <span className="text-slate-300 truncate">
                        Authorization: Bearer {auth.bearer?.token ? (showBearerToken ? auth.bearer.token : '••••••••••••••••') : '<token>'}
                      </span>
                    </div>
                    {auth.bearer?.token && (
                      <button
                        type="button"
                        onClick={() => handleBearerTokenChange('')}
                        className="text-slate-500 hover:text-rose-400 text-[10px] ml-2 shrink-0 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* API Key Form */}
              {auth.type === 'apiKey' && (
                <div className="space-y-4 bg-slate-950/30 border border-slate-850 rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Key Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Key Name
                      </label>
                      <input
                        type="text"
                        value={auth.apiKey?.key || ''}
                        onChange={(e) => handleApiKeyChange('key', e.target.value)}
                        placeholder="e.g. X-API-Key or api_key"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                      />
                    </div>

                    {/* Value */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                        Key Value
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showApiKeyValue ? 'text' : 'password'}
                          value={auth.apiKey?.value || ''}
                          onChange={(e) => handleApiKeyChange('value', e.target.value)}
                          placeholder="Enter API key secret..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-slate-200 placeholder-slate-700 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKeyValue(!showApiKeyValue)}
                          className="absolute right-2.5 text-slate-500 hover:text-slate-300 p-1 transition cursor-pointer"
                          title={showApiKeyValue ? 'Hide key value' : 'Show key value'}
                        >
                          {showApiKeyValue ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Add To Location Selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      Add to
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleApiKeyChange('addTo', 'header')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border cursor-pointer ${
                          auth.apiKey?.addTo === 'header' || !auth.apiKey?.addTo
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900/60'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Header</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApiKeyChange('addTo', 'query')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border cursor-pointer ${
                          auth.apiKey?.addTo === 'query'
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900/60'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Query Parameter</span>
                      </button>
                    </div>
                  </div>

                  {/* Injection Preview */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-lg p-2.5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-indigo-400 font-semibold">
                        {auth.apiKey?.addTo === 'query' ? 'Query Preview:' : 'Header Preview:'}
                      </span>
                      <span className="text-slate-300 truncate">
                        {auth.apiKey?.addTo === 'query'
                          ? `?${auth.apiKey?.key || 'api_key'}=${auth.apiKey?.value ? (showApiKeyValue ? auth.apiKey.value : '••••••••••••••••') : '<value>'}`
                          : `${auth.apiKey?.key || 'X-API-Key'}: ${auth.apiKey?.value ? (showApiKeyValue ? auth.apiKey.value : '••••••••••••••••') : '<value>'}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Autocomplete Datalists */}
      <datalist id="common-headers">
        {COMMON_HEADERS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      <datalist id="common-header-values">
        {COMMON_HEADER_VALUES.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  );
}
