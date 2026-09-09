import React, { useState, useEffect, useRef } from 'react';

interface CollectionModalProps {
  isOpen: boolean;
  title: string;
  initialName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

function CollectionModalContent({
  title,
  initialName = '',
  onClose,
  onSave,
}: Omit<CollectionModalProps, 'isOpen'>) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Collection Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. User Management API"
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition"
              required
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-850">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition duration-150 cursor-pointer disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CollectionModal({
  isOpen,
  title,
  initialName = '',
  onClose,
  onSave,
}: CollectionModalProps) {
  if (!isOpen) return null;

  return (
    <CollectionModalContent
      title={title}
      initialName={initialName}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
