import React, { useState, useEffect } from 'react';
import type { Environment, EnvironmentVariable } from '../types/environment';

interface EnvironmentModalProps {
  isOpen: boolean;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onClose: () => void;
  onCreateEnvironment: (name: string) => string;
  onRenameEnvironment: (id: string, newName: string) => void;
  onDeleteEnvironment: (id: string) => void;
  onSelectEnvironment: (id: string | null) => void;
  onUpdateVariables: (envId: string, variables: EnvironmentVariable[]) => void;
}

export default function EnvironmentModal({
  isOpen,
  environments,
  activeEnvironmentId,
  onClose,
  onCreateEnvironment,
  onRenameEnvironment,
  onDeleteEnvironment,
  onSelectEnvironment,
  onUpdateVariables,
}: EnvironmentModalProps) {
  if (!isOpen) return null;

  return (
    <EnvironmentModalContent
      environments={environments}
      activeEnvironmentId={activeEnvironmentId}
      onClose={onClose}
      onCreateEnvironment={onCreateEnvironment}
      onRenameEnvironment={onRenameEnvironment}
      onDeleteEnvironment={onDeleteEnvironment}
      onSelectEnvironment={onSelectEnvironment}
      onUpdateVariables={onUpdateVariables}
    />
  );
}

function EnvironmentModalContent({
  environments,
  activeEnvironmentId,
  onClose,
  onCreateEnvironment,
  onRenameEnvironment,
  onDeleteEnvironment,
  onSelectEnvironment,
  onUpdateVariables,
}: Omit<EnvironmentModalProps, 'isOpen'>) {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(() => {
    if (activeEnvironmentId && environments.some((e) => e.id === activeEnvironmentId)) {
      return activeEnvironmentId;
    }
    return environments.length > 0 ? environments[0].id : '';
  });

  const [isCreatingEnv, setIsCreatingEnv] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [editingEnvName, setEditingEnvName] = useState('');
  const [revealedValues, setRevealedValues] = useState<Record<string, boolean>>({});
  const [confirmDeleteEnvId, setConfirmDeleteEnvId] = useState<string | null>(null);

  const activeSelectedEnv = environments.find((e) => e.id === selectedEnvId) || (environments.length > 0 ? environments[0] : null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Helper to generate IDs
  const generateVarId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  };

  // Check duplicate variable names within the selected environment
  const getDuplicateNames = (variables: EnvironmentVariable[]) => {
    const counts: Record<string, number> = {};
    for (const v of variables) {
      const name = v.name.trim();
      if (name) {
        counts[name] = (counts[name] || 0) + 1;
      }
    }
    const dupes = new Set<string>();
    for (const [name, count] of Object.entries(counts)) {
      if (count > 1) {
        dupes.add(name);
      }
    }
    return dupes;
  };

  const duplicateNames = activeSelectedEnv ? getDuplicateNames(activeSelectedEnv.variables) : new Set<string>();

  // Handlers for environment creation
  const handleSaveNewEnv = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEnvName.trim()) {
      const createdId = onCreateEnvironment(newEnvName.trim());
      setSelectedEnvId(createdId);
      setNewEnvName('');
      setIsCreatingEnv(false);
    }
  };

  // Handlers for environment rename
  const handleSaveRenameEnv = (envId: string) => {
    if (editingEnvName.trim()) {
      onRenameEnvironment(envId, editingEnvName.trim());
      setEditingEnvId(null);
      setEditingEnvName('');
    }
  };

  // Variable mutators
  const handleAddVariable = () => {
    if (!activeSelectedEnv) return;
    const newVar: EnvironmentVariable = {
      id: generateVarId(),
      name: '',
      value: '',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onUpdateVariables(activeSelectedEnv.id, [...activeSelectedEnv.variables, newVar]);
  };

  const handleUpdateVariableField = (varId: string, field: 'name' | 'value' | 'enabled', value: any) => {
    if (!activeSelectedEnv) return;
    const updated = activeSelectedEnv.variables.map((v) =>
      v.id === varId ? { ...v, [field]: value, updatedAt: Date.now() } : v
    );
    onUpdateVariables(activeSelectedEnv.id, updated);
  };

  const handleDeleteVariable = (varId: string) => {
    if (!activeSelectedEnv) return;
    const updated = activeSelectedEnv.variables.filter((v) => v.id !== varId);
    onUpdateVariables(activeSelectedEnv.id, updated);
  };

  const toggleRevealValue = (varId: string) => {
    setRevealedValues((prev) => ({ ...prev, [varId]: !prev[varId] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full h-[600px] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Environment Manager</h3>
              <p className="text-[10px] text-slate-400">Configure key-value variables referenced as <code className="text-indigo-300 font-mono">{'{{variable_name}}'}</code></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Main Layout: 2-Column Split */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar: Environments List */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/40 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-850 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Environments</span>
              <button
                type="button"
                onClick={() => setIsCreatingEnv(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <span>+ New</span>
              </button>
            </div>

            {/* Create New Inline Input */}
            {isCreatingEnv && (
              <form onSubmit={handleSaveNewEnv} className="p-2 border-b border-slate-850 bg-slate-900/60">
                <input
                  type="text"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="Environment name..."
                  autoFocus
                  className="w-full bg-slate-950 border border-indigo-500/60 text-slate-200 text-xs px-2 py-1 rounded focus:outline-none"
                />
                <div className="flex items-center justify-end space-x-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingEnv(false);
                      setNewEnvName('');
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newEnvName.trim()}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-2 py-0.5 rounded cursor-pointer disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Environments Navigation List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {environments.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-[11px] text-slate-500">No environments</p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingEnv(true)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
                  >
                    + Create First Environment
                  </button>
                </div>
              ) : (
                environments.map((env) => {
                  const isSelected = (activeSelectedEnv?.id === env.id);
                  const isActive = (activeEnvironmentId === env.id);
                  const isEditing = (editingEnvId === env.id);

                  if (isEditing) {
                    return (
                      <div key={env.id} className="p-1.5 bg-slate-850 rounded border border-indigo-500/50">
                        <input
                          type="text"
                          value={editingEnvName}
                          onChange={(e) => setEditingEnvName(e.target.value)}
                          autoFocus
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded focus:outline-none"
                        />
                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <button
                            type="button"
                            onClick={() => setEditingEnvId(null)}
                            className="text-[9px] text-slate-400 px-1"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveRenameEnv(env.id)}
                            className="text-[9px] bg-indigo-600 text-white font-medium px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={env.id}
                      onClick={() => setSelectedEnvId(env.id)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition text-xs ${
                        isSelected
                          ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm'
                          : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate min-w-0">
                        <span className="truncate">{env.name}</span>
                        {isActive && (
                          <span className="text-[8px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono font-bold px-1.5 py-0.2 rounded shrink-0">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Row actions on hover */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEnvId(env.id);
                            setEditingEnvName(env.name);
                          }}
                          className="p-0.5 text-slate-500 hover:text-slate-200 rounded"
                          title="Rename environment"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteEnvId(env.id);
                          }}
                          className="p-0.5 text-slate-500 hover:text-rose-400 rounded"
                          title="Delete environment"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Variable Grid for Active Selected Environment */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/60 p-5">
            {activeSelectedEnv ? (
              <div className="flex flex-col h-full space-y-4">
                {/* Top Info Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-sm font-bold text-slate-100">{activeSelectedEnv.name}</h4>
                    <span className="text-xs text-slate-500 font-mono">
                      {activeSelectedEnv.variables.length} variable{activeSelectedEnv.variables.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {activeEnvironmentId === activeSelectedEnv.id ? (
                      <button
                        type="button"
                        onClick={() => onSelectEnvironment(null)}
                        className="px-2.5 py-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-800/40 rounded-lg transition font-medium cursor-pointer"
                      >
                        ✓ Active (Click to unset)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectEnvironment(activeSelectedEnv.id)}
                        className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-indigo-600 rounded-lg transition font-medium cursor-pointer"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>
                </div>

                {/* Duplicate Names Validation Warning */}
                {duplicateNames.size > 0 && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-center space-x-2 text-rose-300 text-xs">
                    <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      <strong>Validation Error:</strong> Variable names must be unique. Duplicate: {Array.from(duplicateNames).join(', ')}.
                    </span>
                  </div>
                )}

                {/* Variable Table Header */}
                <div className="flex-1 overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2 px-2 w-10 text-center">Use</th>
                        <th className="py-2 px-2 w-1/3">Variable Name</th>
                        <th className="py-2 px-2">Value</th>
                        <th className="py-2 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 font-mono">
                      {activeSelectedEnv.variables.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 italic font-sans text-xs">
                            No variables in this environment. Click below to add one.
                          </td>
                        </tr>
                      ) : (
                        activeSelectedEnv.variables.map((v) => {
                          const isDupe = duplicateNames.has(v.name.trim());
                          const isRevealed = !!revealedValues[v.id];

                          return (
                            <tr key={v.id} className="hover:bg-slate-850/40 transition group/row">
                              {/* Enabled Checkbox */}
                              <td className="py-2 px-2 text-center align-middle">
                                <input
                                  type="checkbox"
                                  checked={v.enabled}
                                  onChange={(e) => handleUpdateVariableField(v.id, 'enabled', e.target.checked)}
                                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              {/* Variable Name */}
                              <td className="py-1.5 px-2 align-middle">
                                <input
                                  type="text"
                                  value={v.name}
                                  onChange={(e) => handleUpdateVariableField(v.id, 'name', e.target.value)}
                                  placeholder="e.g. base_url"
                                  className={`w-full bg-slate-950 border text-xs px-2.5 py-1.5 rounded font-mono focus:outline-none focus:ring-1 ${
                                    isDupe
                                      ? 'border-rose-500 text-rose-300 focus:ring-rose-500'
                                      : 'border-slate-800 text-indigo-300 focus:border-indigo-500 focus:ring-indigo-500/30'
                                  }`}
                                />
                              </td>

                              {/* Variable Value */}
                              <td className="py-1.5 px-2 align-middle">
                                <div className="relative flex items-center">
                                  <input
                                    type={isRevealed ? 'text' : 'password'}
                                    value={v.value}
                                    onChange={(e) => handleUpdateVariableField(v.id, 'value', e.target.value)}
                                    placeholder="Value..."
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 pr-8 rounded font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealValue(v.id)}
                                    className="absolute right-2 text-slate-500 hover:text-slate-300 cursor-pointer p-0.5"
                                    title={isRevealed ? 'Mask value' : 'Show value'}
                                  >
                                    {isRevealed ? (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Delete Variable Button */}
                              <td className="py-2 px-2 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariable(v.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/30 transition cursor-pointer"
                                  title="Delete variable"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Bottom Action */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddVariable}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 py-1 px-2.5 rounded hover:bg-slate-800/60 transition cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Variable</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-xs text-slate-400 font-medium">Select an environment or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal for deleting environment */}
      {confirmDeleteEnvId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h4 className="text-sm font-bold text-slate-100">Delete Environment?</h4>
            <p className="text-xs text-slate-400">
              Are you sure you want to delete this environment and all its configured variables?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setConfirmDeleteEnvId(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteEnvironment(confirmDeleteEnvId);
                  if (selectedEnvId === confirmDeleteEnvId) {
                    const remaining = environments.filter((e) => e.id !== confirmDeleteEnvId);
                    setSelectedEnvId(remaining.length > 0 ? remaining[0].id : '');
                  }
                  setConfirmDeleteEnvId(null);
                }}
                className="px-3.5 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
