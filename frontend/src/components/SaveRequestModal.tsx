import React, { useState, useEffect, useRef } from 'react';
import type { Collection } from '../types/collection';

interface SaveRequestModalProps {
  isOpen: boolean;
  isSaveAs?: boolean;
  initialName?: string;
  initialCollectionId?: string;
  collections: Collection[];
  onClose: () => void;
  onSave: (name: string, collectionId: string) => void;
  onCreateCollection: (name: string) => string;
}

function SaveRequestModalContent({
  isSaveAs = false,
  initialName = '',
  initialCollectionId = '',
  collections,
  onClose,
  onSave,
  onCreateCollection,
}: Omit<SaveRequestModalProps, 'isOpen'>) {
  const [name, setName] = useState(initialName || 'Untitled Request');
  const [collectionId, setCollectionId] = useState(() => {
    if (initialCollectionId && collections.some((c) => c.id === initialCollectionId)) {
      return initialCollectionId;
    }
    return collections.length > 0 ? collections[0].id : '';
  });
  const [isCreatingCollection, setIsCreatingCollection] = useState(collections.length === 0);
  const [newCollectionName, setNewCollectionName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let targetCollectionId = collectionId;

    if (isCreatingCollection) {
      if (!newCollectionName.trim()) return;
      targetCollectionId = onCreateCollection(newCollectionName.trim());
    }

    if (targetCollectionId) {
      onSave(name.trim(), targetCollectionId);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              {isSaveAs ? 'Save Request As' : 'Save Request'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Request Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Request Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Get User Profile"
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition"
              required
            />
          </div>

          {/* Collection Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Target Collection
              </label>
              {collections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreatingCollection(!isCreatingCollection)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  {isCreatingCollection ? 'Select Existing' : '+ New Collection'}
                </button>
              )}
            </div>

            {isCreatingCollection || collections.length === 0 ? (
              <div>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Enter new collection name..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  A new collection will be created automatically.
                </p>
              </div>
            ) : (
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition cursor-pointer"
              >
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.requests.length} requests)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-850">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || (isCreatingCollection && !newCollectionName.trim())}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition duration-150 cursor-pointer disabled:cursor-not-allowed"
            >
              Save Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SaveRequestModal({
  isOpen,
  isSaveAs = false,
  initialName = '',
  initialCollectionId = '',
  collections,
  onClose,
  onSave,
  onCreateCollection,
}: SaveRequestModalProps) {
  if (!isOpen) return null;

  return (
    <SaveRequestModalContent
      isSaveAs={isSaveAs}
      initialName={initialName}
      initialCollectionId={initialCollectionId}
      collections={collections}
      onClose={onClose}
      onSave={onSave}
      onCreateCollection={onCreateCollection}
    />
  );
}
