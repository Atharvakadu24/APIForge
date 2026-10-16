import React, { useState } from 'react';
import type { Collection, CollectionFolder, SavedRequest } from '../types/collection';
import { getAllDescendantFolderIds } from '../services/collectionService';

export type MoveItemTarget =
  | { type: 'request'; request: SavedRequest }
  | { type: 'folder'; folder: CollectionFolder; collection: Collection };

interface MoveItemModalProps {
  isOpen: boolean;
  target: MoveItemTarget | null;
  collections: Collection[];
  onClose: () => void;
  onMoveRequest: (requestId: string, targetCollectionId: string, targetFolderId: string | null) => void;
  onMoveFolder: (folderId: string, targetParentFolderId: string | null) => void;
}

interface DestinationOption {
  id: string; // unique key for option
  collectionId: string;
  folderId: string | null; // null = collection root
  label: string;
  depth: number;
  disabled?: boolean;
}

function flattenFoldersForSelection(
  folders: CollectionFolder[],
  collectionId: string,
  depth: number = 1,
  disabledFolderIds: Set<string> = new Set()
): DestinationOption[] {
  const options: DestinationOption[] = [];
  for (const f of folders) {
    const isDisabled = disabledFolderIds.has(f.id);
    const indent = '— '.repeat(depth);
    options.push({
      id: `${collectionId}::${f.id}`,
      collectionId,
      folderId: f.id,
      label: `${indent}📁 ${f.name}${isDisabled ? ' (Self / Descendant - Disabled)' : ''}`,
      depth,
      disabled: isDisabled,
    });
    if (f.subfolders && f.subfolders.length > 0) {
      options.push(
        ...flattenFoldersForSelection(f.subfolders, collectionId, depth + 1, disabledFolderIds)
      );
    }
  }
  return options;
}

interface MoveItemModalContentProps {
  target: MoveItemTarget;
  collections: Collection[];
  onClose: () => void;
  onMoveRequest: (requestId: string, targetCollectionId: string, targetFolderId: string | null) => void;
  onMoveFolder: (folderId: string, targetParentFolderId: string | null) => void;
}

function MoveItemModalContent({
  target,
  collections,
  onClose,
  onMoveRequest,
  onMoveFolder,
}: MoveItemModalContentProps) {
  const isRequest = target.type === 'request';

  // For folder moves: only destinations in the SAME collection are allowed.
  // We collect disabled IDs: folder itself + all its descendants
  const disabledFolderIds = new Set<string>();
  if (!isRequest) {
    disabledFolderIds.add(target.folder.id);
    const descendantIds = getAllDescendantFolderIds(target.folder);
    descendantIds.forEach((id) => disabledFolderIds.add(id));
  }

  // Build list of all valid destinations
  const destinationOptions: DestinationOption[] = [];

  if (isRequest) {
    for (const col of collections) {
      // 1. Root of this collection
      destinationOptions.push({
        id: `${col.id}::root`,
        collectionId: col.id,
        folderId: null,
        label: `📦 ${col.name} (Collection Root)`,
        depth: 0,
      });
      // 2. All nested folders in this collection
      destinationOptions.push(...flattenFoldersForSelection(col.folders, col.id, 1));
    }
  } else {
    // Only current collection
    const currentCol = target.collection;
    destinationOptions.push({
      id: `${currentCol.id}::root`,
      collectionId: currentCol.id,
      folderId: null,
      label: `📦 ${currentCol.name} (Collection Root)`,
      depth: 0,
    });
    destinationOptions.push(
      ...flattenFoldersForSelection(currentCol.folders, currentCol.id, 1, disabledFolderIds)
    );
  }

  // Initial selection
  const initialOption = isRequest
    ? destinationOptions.find(
        (opt) =>
          opt.collectionId === target.request.collectionId &&
          opt.folderId === target.request.folderId
      ) || destinationOptions[0]
    : destinationOptions.find(
        (opt) =>
          opt.collectionId === target.collection.id &&
          opt.folderId === target.folder.parentFolderId
      ) || destinationOptions[0];

  const [selectedKey, setSelectedKey] = useState<string>(
    initialOption ? initialOption.id : destinationOptions[0]?.id || ''
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const chosen = destinationOptions.find((opt) => opt.id === selectedKey);
    if (!chosen) {
      setError('Please select a destination.');
      return;
    }

    if (chosen.disabled) {
      setError('Cannot move a folder into itself or one of its descendant subfolders.');
      return;
    }

    if (isRequest) {
      onMoveRequest(target.request.id, chosen.collectionId, chosen.folderId);
      onClose();
    } else {
      if (chosen.collectionId !== target.collection.id) {
        setError('Folders can only be moved within their current collection.');
        return;
      }
      onMoveFolder(target.folder.id, chosen.folderId);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate">
                {isRequest ? 'Move Saved Request' : 'Move Folder'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Moving <span className="text-indigo-300 font-semibold">{isRequest ? target.request.name : target.folder.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0 ml-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Destination Location
            </label>
            <div className="relative">
              <select
                value={selectedKey}
                onChange={(e) => {
                  setSelectedKey(e.target.value);
                  setError(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none pr-8"
              >
                {destinationOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg className="fill-current h-3 w-3" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            {!isRequest && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                Note: Folders can only be moved within collection &quot;{target.collection.name}&quot;. Self and subfolder destinations are disabled to prevent circular references.
              </p>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
              <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-850">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition duration-150 cursor-pointer"
            >
              Confirm Move
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MoveItemModal({
  isOpen,
  target,
  collections,
  onClose,
  onMoveRequest,
  onMoveFolder,
}: MoveItemModalProps) {
  if (!isOpen || !target) return null;

  return (
    <MoveItemModalContent
      target={target}
      collections={collections}
      onClose={onClose}
      onMoveRequest={onMoveRequest}
      onMoveFolder={onMoveFolder}
    />
  );
}
