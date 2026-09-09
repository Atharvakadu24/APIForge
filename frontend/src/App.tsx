import React, { useState } from 'react';
import AppShell from './components/AppShell';
import RequestEditor from './components/RequestEditor';
import ResponsePanel from './components/ResponsePanel';
import type { ApiRequest, HttpMethod, KeyValueEntry, RequestAuth, RequestBodyType, ResponseData } from './types/request';
import type { HistoryItem } from './types/history';
import {
  loadHistoryFromStorage,
  saveHistoryToStorage,
  clearHistoryFromStorage,
  cloneRequest,
  MAX_HISTORY_ITEMS,
} from './utils/historyStorage';

function App() {
  const [request, setRequest] = useState<ApiRequest>({
    method: 'GET',
    url: 'http://localhost:3001/api/health',
    queryParams: [],
    headers: [
      { id: 'header-content-type', key: 'Content-Type', value: 'application/json', enabled: true, description: '' },
      { id: 'header-accept', key: 'Accept', value: '*/*', enabled: true, description: '' },
    ],
    bodyType: 'none',
    body: '',
    auth: {
      type: 'none',
    },
  });
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistoryFromStorage());
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const setMethod = (method: HttpMethod) => {
    setRequest((prev) => ({ ...prev, method }));
  };

  const setUrl = (url: string) => {
    setRequest((prev) => ({ ...prev, url }));
  };

  const setQueryParams = (queryParams: KeyValueEntry[]) => {
    setRequest((prev) => ({ ...prev, queryParams }));
  };

  const setHeaders = (headers: KeyValueEntry[]) => {
    setRequest((prev) => ({ ...prev, headers }));
  };

  const setBody = (body: string) => {
    setRequest((prev) => ({ ...prev, body }));
  };

  const setBodyType = (bodyType: RequestBodyType) => {
    setRequest((prev) => ({ ...prev, bodyType }));
  };

  const setAuth = (auth: RequestAuth) => {
    setRequest((prev) => ({ ...prev, auth }));
  };

  const generateHistoryId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  };

  const recordHistory = (
    reqConfig: ApiRequest,
    resData: ResponseData,
    fallbackLatency: number
  ) => {
    const historyItem: HistoryItem = {
      id: generateHistoryId(),
      timestamp: Date.now(),
      method: reqConfig.method,
      url: reqConfig.url,
      status: resData.status,
      statusText: resData.statusText || '',
      latency: resData.time || fallbackLatency,
      size: resData.size || 0,
      isError: resData.isError,
      request: cloneRequest(reqConfig),
      response: resData,
    };

    setHistory((prev) => {
      const next = [historyItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      saveHistoryToStorage(next);
      return next;
    });
    setSelectedHistoryId(historyItem.id);
  };

  const handleSend = async () => {
    setIsSending(true);
    setResponse(null);
    const startTime = performance.now();
    try {
      const res = await fetch('http://localhost:3001/api/request/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data: ResponseData = await res.json();
      setResponse(data);
      recordHistory(request, data, Math.round(performance.now() - startTime));
    } catch (err: any) {
      const endTime = performance.now();
      const errPayload = {
        error: 'Backend Proxy Unavailable',
        message: err.message || 'Failed to reach APIForge backend at http://localhost:3001',
        suggestion: 'Ensure the APIForge backend server is running.',
      };
      const errBody = JSON.stringify(errPayload, null, 2);
      const errorResponse: ResponseData = {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/json' },
        time: Math.round(endTime - startTime),
        size: new Blob([errBody]).size,
        body: errBody,
        isError: true,
        errorMessage: err.message,
      };

      setResponse(errorResponse);
      recordHistory(request, errorResponse, errorResponse.time);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setRequest(cloneRequest(item.request));
    setResponse(item.response ? { ...item.response } : null);
    setSelectedHistoryId(item.id);
  };

  const handleClearHistory = () => {
    setHistory([]);
    clearHistoryFromStorage();
    setSelectedHistoryId(null);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveHistoryToStorage(next);
      return next;
    });
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
  };

  return (
    <AppShell
      history={history}
      selectedHistoryId={selectedHistoryId}
      onSelectHistory={handleSelectHistory}
      onClearHistory={handleClearHistory}
      onDeleteHistoryItem={handleDeleteHistoryItem}
    >
      {/* Centered Workspace layout */}
      <div className="max-w-5xl w-full mx-auto flex flex-col space-y-4 h-full">
        {/* Development Status banner (inline to fit shell) */}
        <div className="bg-slate-900/40 border border-slate-850 px-4 py-2 rounded-lg flex items-center justify-between text-xs text-slate-400 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-350">Status: Backend Engine Active</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Phase 2: Request History Milestone</span>
        </div>

        {/* Workspace Panels (Request Editor + Response Inspector) */}
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden min-h-0">
          <RequestEditor
            method={request.method}
            setMethod={setMethod}
            url={request.url}
            setUrl={setUrl}
            queryParams={request.queryParams}
            setQueryParams={setQueryParams}
            headers={request.headers}
            setHeaders={setHeaders}
            bodyType={request.bodyType}
            setBodyType={setBodyType}
            body={request.body}
            setBody={setBody}
            auth={request.auth}
            setAuth={setAuth}
            onSend={handleSend}
            isSending={isSending}
          />
          
          <ResponsePanel
            response={response}
            isSending={isSending}
          />
        </div>
      </div>
    </AppShell>
  );
}

export default App;
