import React, { useState, useRef } from 'react';
import type { ApiRequest } from '../types/request';
import { validateAndParseImportedJson } from '../utils/importExportUtils';

interface ImportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (request: ApiRequest) => void;
}

export default function ImportRequestModal({
  isOpen,
  onClose,
  onImport,
}: ImportRequestModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'raw'>('file');
  const [rawJsonText, setRawJsonText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ApiRequest | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setRawJsonText('');
    setFileName(null);
    setValidationError(null);
    setParsedPreview(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processContent = (content: string, sourceName?: string) => {
    if (sourceName) {
      setFileName(sourceName);
    }
    setRawJsonText(content);

    const result = validateAndParseImportedJson(content);
    if (result.success) {
      setValidationError(null);
      setParsedPreview(result.request);
    } else {
      setValidationError(result.error);
      setParsedPreview(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processContent(text, file.name);
    };
    reader.onerror = () => {
      setValidationError('Failed to read selected file.');
      setParsedPreview(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processContent(text, file.name);
    };
    reader.onerror = () => {
      setValidationError('Failed to read dropped file.');
      setParsedPreview(null);
    };
    reader.readAsText(file);
  };

  const handleRawTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    processContent(text);
  };

  const handleConfirmImport = () => {
    if (parsedPreview) {
      onImport(parsedPreview);
      handleClose();
    }
  };

  const getMethodColor = (m?: string) => {
    switch (m) {
      case 'GET': return 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60';
      case 'POST': return 'text-sky-400 bg-sky-950/80 border-sky-800/60';
      case 'PUT': return 'text-amber-400 bg-amber-950/80 border-amber-800/60';
      case 'DELETE': return 'text-rose-400 bg-rose-950/80 border-rose-800/60';
      case 'PATCH': return 'text-indigo-400 bg-indigo-950/80 border-indigo-800/60';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Import Request</h3>
              <p className="text-[11px] text-slate-400">Import an APIForge JSON request file into the editor</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-800 px-5 bg-slate-950/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${
              activeTab === 'file'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Upload JSON File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`py-2.5 px-4 transition border-b-2 cursor-pointer ${
              activeTab === 'raw'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Paste JSON Text
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-950/20'
                    : fileName
                    ? 'border-indigo-500/60 bg-slate-950/40'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shadow-inner">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {fileName ? (
                      <span className="text-indigo-300 font-mono">{fileName}</span>
                    ) : (
                      'Click to select or drag and drop your .json file'
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supports APIForge request export JSON files
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Paste JSON Request Content
              </label>
              <textarea
                value={rawJsonText}
                onChange={handleRawTextChange}
                placeholder="Paste APIForge JSON export payload here..."
                rows={8}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-700 font-mono text-xs rounded-lg p-3 focus:outline-none focus:border-indigo-500 transition resize-y"
                spellCheck={false}
              />
            </div>
          )}

          {/* Validation Error Alert */}
          {validationError && (
            <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 text-rose-300 text-xs flex items-start space-x-2 animate-fade-in font-mono">
              <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-semibold text-rose-400">Import Validation Error: </span>
                <span>{validationError}</span>
              </div>
            </div>
          )}

          {/* Parsed Request Preview */}
          {parsedPreview && (
            <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3.5 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                  Ready to Import
                </span>
                <span className="text-emerald-400 text-[11px] font-semibold flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Valid Request</span>
                </span>
              </div>

              {/* Method and URL line */}
              <div className="flex items-center space-x-2 min-w-0 bg-slate-900/80 border border-slate-800/80 p-2 rounded-lg">
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${getMethodColor(parsedPreview.method)}`}>
                  {parsedPreview.method}
                </span>
                <span className="text-xs font-mono text-slate-200 truncate" title={parsedPreview.url || '<Empty URL>'}>
                  {parsedPreview.url || '<No URL specified>'}
                </span>
              </div>

              {/* Request metadata tags */}
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-slate-400">
                <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  Body: <span className="text-indigo-300">{parsedPreview.bodyType}</span>
                </span>
                <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  Headers: <span className="text-indigo-300">{parsedPreview.headers?.length || 0}</span>
                </span>
                <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  Params: <span className="text-indigo-300">{parsedPreview.queryParams?.length || 0}</span>
                </span>
                {parsedPreview.bodyType === 'x-www-form-urlencoded' && (
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    Form Fields: <span className="text-indigo-300">{parsedPreview.formUrlEncoded?.length || 0}</span>
                  </span>
                )}
                {parsedPreview.bodyType === 'multipart/form-data' && (
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                    Multipart Fields: <span className="text-indigo-300">{parsedPreview.multipartFormData?.length || 0}</span>
                  </span>
                )}
                <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                  Auth: <span className="text-indigo-300">{parsedPreview.auth?.type || 'none'}</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Note: Importing will load this configuration into your Request Editor. It will not overwrite your saved requests or automatically save to Supabase.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-2.5 px-5 py-3.5 border-t border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={handleClose}
            className="bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-medium text-xs py-2 px-4 rounded-lg transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!parsedPreview}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold text-xs py-2 px-4.5 rounded-lg shadow-lg shadow-indigo-600/20 transition duration-150 flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import into Editor</span>
          </button>
        </div>
      </div>
    </div>
  );
}
