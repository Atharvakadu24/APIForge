import React, { useState } from 'react';
import AppShell from './components/AppShell';
import RequestEditor from './components/RequestEditor';
import ResponsePanel from './components/ResponsePanel';
import SaveRequestModal from './components/SaveRequestModal';
import CollectionModal from './components/CollectionModal';
import ConfirmModal from './components/ConfirmModal';
import type { ApiRequest, HttpMethod, KeyValueEntry, RequestAuth, RequestBodyType, ResponseData } from './types/request';
import type { HistoryItem } from './types/history';
import type { Collection, SavedRequest } from './types/collection';
import {
  loadHistoryFromStorage,
  saveHistoryToStorage,
  clearHistoryFromStorage,
  cloneRequest,
  MAX_HISTORY_ITEMS,
} from './utils/historyStorage';
import {
  loadCollectionsFromStorage,
  saveCollectionsToStorage,
} from './utils/collectionStorage';

const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

const DEFAULT_REQUEST: ApiRequest = {
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
};

function App() {
  const [request, setRequest] = useState<ApiRequest>(() => cloneRequest(DEFAULT_REQUEST));
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistoryFromStorage());
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Collections State
  const [collections, setCollections] = useState<Collection[]>(() => loadCollectionsFromStorage());
  const [activeSavedRequestId, setActiveSavedRequestId] = useState<string | null>(null);

  // Modals State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [collectionModalState, setCollectionModalState] = useState<{
    isOpen: boolean;
    title: string;
    initialName: string;
    onSave: (name: string) => void;
  }>({
    isOpen: false,
    title: '',
    initialName: '',
    onSave: () => {},
  });

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Request State Mutators
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

  // Active saved request lookup
  const activeSavedRequest = collections
    .flatMap((c) => c.requests)
    .find((r) => r.id === activeSavedRequestId);
  const activeSavedRequestName = activeSavedRequest ? activeSavedRequest.name : null;

  // New Request handler (clears activeSavedRequestId and resets editor to default)
  const handleNewRequest = () => {
    setRequest(cloneRequest(DEFAULT_REQUEST));
    setResponse(null);
    setActiveSavedRequestId(null);
    setSelectedHistoryId(null);
  };

  // Record history
  const recordHistory = (
    reqConfig: ApiRequest,
    resData: ResponseData,
    fallbackLatency: number
  ) => {
    const historyItem: HistoryItem = {
      id: generateUniqueId(),
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

  // Execute request
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

  // History Actions
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

  // Collection CRUD
  const handleCreateCollection = (name: string): string => {
    const newId = generateUniqueId();
    const newCollection: Collection = {
      id: newId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      requests: [],
    };
    setCollections((prev) => {
      const next = [...prev, newCollection];
      saveCollectionsToStorage(next);
      return next;
    });
    return newId;
  };

  const handleRenameCollection = (collectionId: string, newName: string) => {
    setCollections((prev) => {
      const next = prev.map((c) =>
        c.id === collectionId ? { ...c, name: newName, updatedAt: Date.now() } : c
      );
      saveCollectionsToStorage(next);
      return next;
    });
  };

  const handleOpenCreateCollectionModal = () => {
    setCollectionModalState({
      isOpen: true,
      title: 'New Collection',
      initialName: '',
      onSave: (name: string) => {
        handleCreateCollection(name);
      },
    });
  };

  const handleOpenRenameCollectionModal = (collection: Collection) => {
    setCollectionModalState({
      isOpen: true,
      title: 'Rename Collection',
      initialName: collection.name,
      onSave: (newName: string) => {
        handleRenameCollection(collection.id, newName);
      },
    });
  };

  const handleDeleteCollectionPrompt = (collection: Collection) => {
    const count = collection.requests.length;
    const message = count > 0
      ? `Are you sure you want to delete "${collection.name}"? This will permanently remove the collection and all ${count} saved request${count > 1 ? 's' : ''} inside it.`
      : `Are you sure you want to delete "${collection.name}"?`;

    setConfirmModalState({
      isOpen: true,
      title: 'Delete Collection',
      message,
      onConfirm: () => {
        setCollections((prev) => {
          const next = prev.filter((c) => c.id !== collection.id);
          saveCollectionsToStorage(next);
          return next;
        });
        if (activeSavedRequest && activeSavedRequest.collectionId === collection.id) {
          setActiveSavedRequestId(null);
        }
      },
    });
  };

  // Saved Request CRUD
  const handleSelectSavedRequest = (savedReq: SavedRequest) => {
    setRequest(cloneRequest(savedReq.request));
    setActiveSavedRequestId(savedReq.id);
    setSelectedHistoryId(null);
  };

  const handleSaveRequestSubmit = (name: string, targetCollectionId: string) => {
    const newSavedRequest: SavedRequest = {
      id: generateUniqueId(),
      collectionId: targetCollectionId,
      name,
      request: cloneRequest(request),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setCollections((prev) => {
      const next = prev.map((c) => {
        if (c.id === targetCollectionId) {
          return {
            ...c,
            updatedAt: Date.now(),
            requests: [...c.requests, newSavedRequest],
          };
        }
        return c;
      });
      saveCollectionsToStorage(next);
      return next;
    });

    setActiveSavedRequestId(newSavedRequest.id);
  };

  const handleUpdateSavedRequest = () => {
    if (!activeSavedRequestId) {
      setIsSaveModalOpen(true);
      return;
    }

    setCollections((prev) => {
      const next = prev.map((c) => {
        const hasReq = c.requests.some((r) => r.id === activeSavedRequestId);
        if (!hasReq) return c;
        return {
          ...c,
          updatedAt: Date.now(),
          requests: c.requests.map((r) =>
            r.id === activeSavedRequestId
              ? { ...r, request: cloneRequest(request), updatedAt: Date.now() }
              : r
          ),
        };
      });
      saveCollectionsToStorage(next);
      return next;
    });
  };

  const handleDeleteSavedRequest = (collectionId: string, requestId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollections((prev) => {
      const next = prev.map((c) => {
        if (c.id === collectionId) {
          return {
            ...c,
            updatedAt: Date.now(),
            requests: c.requests.filter((r) => r.id !== requestId),
          };
        }
        return c;
      });
      saveCollectionsToStorage(next);
      return next;
    });

    if (activeSavedRequestId === requestId) {
      setActiveSavedRequestId(null);
    }
  };

  return (
    <AppShell
      collections={collections}
      activeSavedRequestId={activeSavedRequestId}
      onSelectSavedRequest={handleSelectSavedRequest}
      onOpenCreateCollection={handleOpenCreateCollectionModal}
      onOpenRenameCollection={handleOpenRenameCollectionModal}
      onDeleteCollectionPrompt={handleDeleteCollectionPrompt}
      onDeleteSavedRequest={handleDeleteSavedRequest}
      onNewRequest={handleNewRequest}
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
          <span className="text-[10px] text-slate-500 font-mono">Phase 2: Saved Requests + Collections</span>
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
            activeSavedRequestName={activeSavedRequestName}
            onSave={() => setIsSaveModalOpen(true)}
            onSaveAs={() => setIsSaveAsModalOpen(true)}
            onUpdate={activeSavedRequestId ? handleUpdateSavedRequest : undefined}
          />
          
          <ResponsePanel
            response={response}
            isSending={isSending}
          />
        </div>
      </div>

      {/* Save Request Modal */}
      <SaveRequestModal
        isOpen={isSaveModalOpen}
        isSaveAs={false}
        initialName={activeSavedRequestName || ''}
        initialCollectionId={activeSavedRequest?.collectionId || ''}
        collections={collections}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveRequestSubmit}
        onCreateCollection={handleCreateCollection}
      />

      {/* Save Request As Modal */}
      <SaveRequestModal
        isOpen={isSaveAsModalOpen}
        isSaveAs={true}
        initialName={activeSavedRequestName ? `${activeSavedRequestName} (Copy)` : ''}
        initialCollectionId={activeSavedRequest?.collectionId || ''}
        collections={collections}
        onClose={() => setIsSaveAsModalOpen(false)}
        onSave={handleSaveRequestSubmit}
        onCreateCollection={handleCreateCollection}
      />

      {/* Create / Rename Collection Modal */}
      <CollectionModal
        isOpen={collectionModalState.isOpen}
        title={collectionModalState.title}
        initialName={collectionModalState.initialName}
        onClose={() => setCollectionModalState((prev) => ({ ...prev, isOpen: false }))}
        onSave={collectionModalState.onSave}
      />

      {/* Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        onConfirm={confirmModalState.onConfirm}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </AppShell>
  );
}

export default App;
