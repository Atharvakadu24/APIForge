import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import AuthScreen from './components/AuthScreen';
import LoadingScreen from './components/LoadingScreen';
import AppShell from './components/AppShell';
import RequestEditor from './components/RequestEditor';
import ResponsePanel from './components/ResponsePanel';
import SaveRequestModal from './components/SaveRequestModal';
import CollectionModal from './components/CollectionModal';
import ConfirmModal from './components/ConfirmModal';
import EnvironmentModal from './components/EnvironmentModal';
import CommandPaletteModal from './components/CommandPaletteModal';
import type { ApiRequest, HttpMethod, KeyValueEntry, RequestAuth, RequestBodyType, ResponseData } from './types/request';
import type { HistoryItem } from './types/history';
import type { Collection, SavedRequest } from './types/collection';
import type { Environment, EnvironmentVariable } from './types/environment';
import * as collectionService from './services/collectionService';
import * as environmentService from './services/environmentService';
import * as historyService from './services/historyService';
import {
  cloneRequest,
  MAX_HISTORY_ITEMS,
} from './utils/historyStorage';
import {
  loadActiveEnvironmentId,
  saveActiveEnvironmentId,
} from './utils/environmentStorage';
import { resolveApiRequest } from './utils/variableResolver';


const DEFAULT_REQUEST: ApiRequest = {
  method: 'GET',
  url: '',
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

interface AuthenticatedWorkspaceProps {
  user: User;
  onSignOut: () => void;
}

function AuthenticatedWorkspace({ user, onSignOut }: AuthenticatedWorkspaceProps) {
  const [request, setRequest] = useState<ApiRequest>(() => cloneRequest(DEFAULT_REQUEST));
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [editorResetSignal, setEditorResetSignal] = useState(0);
  
  // History State (Persisted in Supabase PostgreSQL)
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Collections State (Persisted in Supabase PostgreSQL)
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState<boolean>(true);
  const [activeSavedRequestId, setActiveSavedRequestId] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Environments State (Persisted in Supabase PostgreSQL)
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(null);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);

  // Modals State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
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

  // Global keyboard shortcuts (Ctrl+K / Cmd+K for Command Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function initializeCloudWorkspace() {
      setIsLoadingCollections(true);

      // 1. Fetch & sync Collections
      try {
        const { data: cloudCols, error: colsErr } = await collectionService.getCollections();

        if (colsErr) {
          if (!isCancelled) {
            setCloudError(`Failed to load collections from Supabase: ${colsErr.message}`);
            setIsLoadingCollections(false);
          }
        } else {
          const initialCloud = cloudCols || [];
          const migrationResult = await collectionService.syncOrMigrateLegacyCollections(
            user.id,
            initialCloud
          );

          if (!isCancelled) {
            if (migrationResult.error) {
              setCloudError(`Collections migration notice: ${migrationResult.error.message}`);
            }
            setCollections(migrationResult.collections);
            setIsLoadingCollections(false);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error loading collections';
          setCloudError(msg);
          setIsLoadingCollections(false);
        }
      }

      // 2. Fetch & sync Environments
      try {
        const { data: cloudEnvs, error: envsErr } = await environmentService.getEnvironments();

        if (envsErr) {
          if (!isCancelled) {
            setCloudError(`Failed to load environments from Supabase: ${envsErr.message}`);
          }
        } else {
          const initialCloud = cloudEnvs || [];
          const migrationResult = await environmentService.syncOrMigrateLegacyEnvironments(
            user.id,
            initialCloud
          );

          if (!isCancelled) {
            if (migrationResult.error) {
              setCloudError(`Environments migration notice: ${migrationResult.error.message}`);
            }
            const resolvedEnvs = migrationResult.environments;
            setEnvironments(resolvedEnvs);

            // Validate stored active environment ID against loaded cloud environments
            const storedActiveId = loadActiveEnvironmentId(resolvedEnvs);
            setActiveEnvironmentId(storedActiveId);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error loading environments';
          setCloudError(msg);
        }
      }

      // 3. Fetch & sync History
      try {
        const { data: cloudHistory, error: historyErr } = await historyService.getHistory();

        if (historyErr) {
          if (!isCancelled) {
            setCloudError(`Failed to load request history from Supabase: ${historyErr.message}`);
          }
        } else {
          const initialHistory = cloudHistory || [];
          const migrationResult = await historyService.syncOrMigrateLegacyHistory(
            user.id,
            initialHistory
          );

          if (!isCancelled) {
            if (migrationResult.error) {
              setCloudError(`History migration notice: ${migrationResult.error.message}`);
            }
            setHistory(migrationResult.history);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error loading history';
          setCloudError(msg);
        }
      }
    }

    initializeCloudWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [user.id]);

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

  // Active Environment lookup
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) || null;

  // Active saved request lookup
  const activeSavedRequest = collections
    .flatMap((c) => c.requests)
    .find((r) => r.id === activeSavedRequestId);
  const activeSavedRequestName = activeSavedRequest ? activeSavedRequest.name : null;

  // New Request handler (clears activeSavedRequestId, resets editor to clean default, and resets tab)
  const handleNewRequest = () => {
    setRequest(cloneRequest(DEFAULT_REQUEST));
    setResponse(null);
    setActiveSavedRequestId(null);
    setSelectedHistoryId(null);
    setEditorResetSignal((prev) => prev + 1);
  };

  // Record history (persists template request with variables in Supabase)
  const recordHistory = async (
    reqConfig: ApiRequest,
    resData: ResponseData,
    fallbackLatency: number
  ) => {
    const newItemData = {
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

    const { data, error } = await historyService.addHistoryItem(newItemData);
    if (error || !data) {
      setCloudError(`Failed to persist request history: ${error?.message || 'Unknown error'}`);
      return;
    }

    setHistory((prev) => [data, ...prev.filter((item) => item.id !== data.id)].slice(0, MAX_HISTORY_ITEMS));
    setSelectedHistoryId(data.id);
  };

  // Execute request with variable resolution
  const handleSend = async () => {
    setIsSending(true);
    setResponse(null);

    // 1. Resolve environment variables on a cloned request
    const resolution = resolveApiRequest(request, activeEnvironment);

    // 2. If unresolved variables are detected, halt and show structured error
    if (!resolution.isValid) {
      setIsSending(false);
      const errPayload = {
        error: 'Unresolved Environment Variables',
        message: 'The request contains variable placeholders that could not be resolved in the active environment.',
        activeEnvironment: activeEnvironment ? activeEnvironment.name : 'No Environment',
        unresolvedVariables: resolution.unresolved,
        suggestion: 'Check that the referenced variables are defined and enabled in the Environment Manager.',
      };
      const errBody = JSON.stringify(errPayload, null, 2);
      setResponse({
        status: 400,
        statusText: 'Bad Request (Unresolved Variables)',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: new Blob([errBody]).size,
        body: errBody,
        isError: true,
        errorMessage: `Unresolved variables: ${resolution.unresolved.map((u) => `{{${u.name}}}`).join(', ')}`,
      });
      return;
    }

    // 3. Resolve active Supabase authentication token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (sessionError || !token) {
      setIsSending(false);
      const errPayload = {
        error: 'Authentication Required',
        message: 'No active Supabase session found. Please sign in to execute API requests.',
        suggestion: 'Ensure you are signed in. If your session expired, sign out and sign back in.',
      };
      const errBody = JSON.stringify(errPayload, null, 2);
      setResponse({
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'application/json' },
        time: 0,
        size: new Blob([errBody]).size,
        body: errBody,
        isError: true,
        errorMessage: 'Missing active Supabase authentication session.',
      });
      return;
    }

    // 4. Dispatch resolved request to backend execution proxy with Bearer token
    const startTime = performance.now();
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/request/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(resolution.resolvedRequest),
      });

      const data: ResponseData = await res.json();
      setResponse(data);
      recordHistory(request, data, Math.round(performance.now() - startTime));
    } catch (err: unknown) {
      const endTime = performance.now();
      const errorMsg = err instanceof Error ? err.message : 'Failed to reach APIForge backend';
      const errPayload = {
        error: 'Backend Proxy Unavailable',
        message: errorMsg,
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
        errorMessage: errorMsg,
      };

      setResponse(errorResponse);
      recordHistory(request, errorResponse, errorResponse.time);
    } finally {
      setIsSending(false);
    }
  };

  // Environment Handlers (Supabase PostgreSQL)
  const handleSelectEnvironment = (id: string | null) => {
    setActiveEnvironmentId(id);
    saveActiveEnvironmentId(id);
  };

  const handleCreateEnvironment = async (name: string): Promise<string> => {
    setCloudError(null);
    const { data, error } = await environmentService.createEnvironment(name);
    if (error || !data) {
      const msg = `Failed to create environment: ${error?.message || 'Unknown error'}`;
      setCloudError(msg);
      throw new Error(msg);
    }
    setEnvironments((prev) => [...prev, data]);
    if (!activeEnvironmentId) {
      setActiveEnvironmentId(data.id);
      saveActiveEnvironmentId(data.id);
    }
    return data.id;
  };

  const handleRenameEnvironment = async (id: string, newName: string) => {
    setCloudError(null);
    const { data, error } = await environmentService.renameEnvironment(id, newName);
    if (error || !data) {
      setCloudError(`Failed to rename environment: ${error?.message || 'Unknown error'}`);
      return;
    }
    setEnvironments((prev) =>
      prev.map((e) => (e.id === id ? { ...e, name: data.name, updatedAt: data.updatedAt } : e))
    );
  };

  const handleDeleteEnvironment = async (id: string) => {
    setCloudError(null);
    const { error } = await environmentService.deleteEnvironment(id);
    if (error) {
      setCloudError(`Failed to delete environment: ${error.message}`);
      return;
    }
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
    if (activeEnvironmentId === id) {
      setActiveEnvironmentId(null);
      saveActiveEnvironmentId(null);
    }
  };

  const handleUpdateEnvironmentVariables = async (envId: string, variables: EnvironmentVariable[]) => {
    setCloudError(null);
    const { data, error } = await environmentService.updateEnvironmentVariables(envId, variables);
    if (error || !data) {
      setCloudError(`Failed to save environment variables: ${error?.message || 'Unknown error'}`);
      return;
    }
    setEnvironments((prev) =>
      prev.map((e) => (e.id === envId ? data : e))
    );
  };

  // History Actions (Supabase PostgreSQL)
  const handleSelectHistory = (item: HistoryItem) => {
    setRequest(cloneRequest(item.request));
    setResponse(item.response ? { ...item.response } : null);
    setSelectedHistoryId(item.id);
  };

  const handleClearHistory = async () => {
    setCloudError(null);
    const { error } = await historyService.clearHistory();
    if (error) {
      setCloudError(`Failed to clear request history: ${error.message}`);
      return;
    }
    setHistory([]);
    setSelectedHistoryId(null);
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCloudError(null);
    const { error } = await historyService.deleteHistoryItem(id);
    if (error) {
      setCloudError(`Failed to delete history item: ${error.message}`);
      return;
    }
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
  };

  // Supabase Collections CRUD
  const handleCreateCollection = async (name: string): Promise<string> => {
    setCloudError(null);
    const { data, error } = await collectionService.createCollection(name);
    if (error || !data) {
      setCloudError(`Failed to create collection: ${error?.message || 'Unknown error'}`);
      throw new Error(error?.message || 'Failed to create collection');
    }

    setCollections((prev) => [...prev, data]);
    return data.id;
  };

  const handleRenameCollection = async (collectionId: string, newName: string) => {
    setCloudError(null);
    const { data, error } = await collectionService.renameCollection(collectionId, newName);
    if (error || !data) {
      setCloudError(`Failed to rename collection: ${error?.message || 'Unknown error'}`);
      return;
    }

    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, name: data.name, updatedAt: data.updatedAt } : c))
    );
  };

  const handleOpenCreateCollectionModal = () => {
    setCollectionModalState({
      isOpen: true,
      title: 'New Collection',
      initialName: '',
      onSave: (name: string) => {
        handleCreateCollection(name).catch((err) => console.error(err));
      },
    });
  };

  const handleOpenRenameCollectionModal = (collection: Collection) => {
    setCollectionModalState({
      isOpen: true,
      title: 'Rename Collection',
      initialName: collection.name,
      onSave: (newName: string) => {
        handleRenameCollection(collection.id, newName).catch((err) => console.error(err));
      },
    });
  };

  const handleDeleteCollectionPrompt = (collection: Collection) => {
    const count = collection.requests.length;
    const message = count > 0
      ? `Are you sure you want to delete "${collection.name}"? This will permanently remove the collection and all ${count} saved request${count > 1 ? 's' : ''} from your Supabase cloud database.`
      : `Are you sure you want to delete "${collection.name}"?`;

    setConfirmModalState({
      isOpen: true,
      title: 'Delete Collection',
      message,
      onConfirm: async () => {
        setCloudError(null);
        const { error } = await collectionService.deleteCollection(collection.id);
        if (error) {
          setCloudError(`Failed to delete collection: ${error.message}`);
          return;
        }

        setCollections((prev) => prev.filter((c) => c.id !== collection.id));
        if (activeSavedRequest && activeSavedRequest.collectionId === collection.id) {
          setActiveSavedRequestId(null);
        }
      },
    });
  };

  // Supabase Saved Request CRUD
  const handleSelectSavedRequest = (savedReq: SavedRequest) => {
    setRequest(cloneRequest(savedReq.request));
    setActiveSavedRequestId(savedReq.id);
    setSelectedHistoryId(null);
  };

  const handleSaveRequestSubmit = async (name: string, targetCollectionId: string) => {
    setCloudError(null);
    const { data, error } = await collectionService.createSavedRequest(
      targetCollectionId,
      name,
      cloneRequest(request)
    );

    if (error || !data) {
      setCloudError(`Failed to save request: ${error?.message || 'Unknown error'}`);
      return;
    }

    setCollections((prev) =>
      prev.map((c) => {
        if (c.id === targetCollectionId) {
          return {
            ...c,
            updatedAt: Date.now(),
            requests: [...c.requests, data],
          };
        }
        return c;
      })
    );

    setActiveSavedRequestId(data.id);
  };

  const handleUpdateSavedRequest = async () => {
    if (!activeSavedRequestId) {
      setIsSaveModalOpen(true);
      return;
    }

    setCloudError(null);
    const { data, error } = await collectionService.updateSavedRequest(
      activeSavedRequestId,
      cloneRequest(request)
    );

    if (error || !data) {
      setCloudError(`Failed to update request: ${error?.message || 'Unknown error'}`);
      return;
    }

    setCollections((prev) =>
      prev.map((c) => {
        const hasReq = c.requests.some((r) => r.id === activeSavedRequestId);
        if (!hasReq) return c;
        return {
          ...c,
          updatedAt: Date.now(),
          requests: c.requests.map((r) => (r.id === activeSavedRequestId ? data : r)),
        };
      })
    );
  };

  const handleDeleteSavedRequest = async (
    collectionId: string,
    requestId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setCloudError(null);

    const { error } = await collectionService.deleteSavedRequest(requestId);
    if (error) {
      setCloudError(`Failed to delete saved request: ${error.message}`);
      return;
    }

    setCollections((prev) =>
      prev.map((c) => {
        if (c.id === collectionId) {
          return {
            ...c,
            updatedAt: Date.now(),
            requests: c.requests.filter((r) => r.id !== requestId),
          };
        }
        return c;
      })
    );

    if (activeSavedRequestId === requestId) {
      setActiveSavedRequestId(null);
    }
  };

  return (
    <AppShell
      collections={collections}
      isLoadingCollections={isLoadingCollections}
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
      environments={environments}
      activeEnvironmentId={activeEnvironmentId}
      onSelectEnvironment={handleSelectEnvironment}
      onOpenEnvironmentManager={() => setIsEnvironmentModalOpen(true)}
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      user={user}
      onSignOut={onSignOut}
    >
      {/* Centered Workspace layout */}
      <div className="max-w-5xl w-full mx-auto flex flex-col space-y-4 h-full">
        {/* Workspace status bar */}
        <div className="bg-slate-900/40 border border-slate-850 px-4 py-2 rounded-lg flex items-center justify-between text-xs text-slate-400 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-300">Status: Backend Engine Active</span>
            {activeEnvironment && (
              <span className="text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded-full ml-2">
                Env: {activeEnvironment.name}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-indigo-350 font-mono flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Cloud Sync: Collections, Environments & History Active</span>
            </span>
          </div>
        </div>

        {/* Cloud Error Banner */}
        {cloudError && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-3 text-rose-300 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{cloudError}</span>
            </div>
            <button
              type="button"
              onClick={() => setCloudError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-semibold px-2 py-0.5 rounded hover:bg-rose-900/40 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Workspace Panels (Request Editor + Response Inspector) */}
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden min-h-0">
          <RequestEditor
            key={editorResetSignal}
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

      {/* Quick Search / Command Palette Modal (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        collections={collections}
        environments={environments}
        history={history}
        activeEnvironmentId={activeEnvironmentId}
        onSelectSavedRequest={handleSelectSavedRequest}
        onSelectHistory={handleSelectHistory}
        onSelectEnvironment={handleSelectEnvironment}
      />

      {/* Environment Manager Modal */}
      <EnvironmentModal
        isOpen={isEnvironmentModalOpen}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onClose={() => setIsEnvironmentModalOpen(false)}
        onCreateEnvironment={handleCreateEnvironment}
        onRenameEnvironment={handleRenameEnvironment}
        onDeleteEnvironment={handleDeleteEnvironment}
        onSelectEnvironment={handleSelectEnvironment}
        onUpdateVariables={handleUpdateEnvironmentVariables}
      />

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

function AppContent() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AuthenticatedWorkspace user={user} onSignOut={signOut} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
