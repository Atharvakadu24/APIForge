import React, { useState, useMemo } from 'react';
import type { ApiRequest } from '../types/request';
import {
  SUPPORTED_LANGUAGES,
  type SupportedSnippetLanguage,
  generateSnippet,
} from '../utils/codeGenerators';

interface CodeSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
}

function CodeSnippetModalContent({
  onClose,
  request,
}: Omit<CodeSnippetModalProps, 'isOpen'>) {
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedSnippetLanguage>('curl');
  const [copied, setCopied] = useState(false);

  // Generate code snippet purely in memory from current request
  const snippet = useMemo(() => {
    return generateSnippet(selectedLanguage, request);
  }, [selectedLanguage, request]);

  const handleCopy = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Generate Code</h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {request.method} {request.url || 'https://api.example.com'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close modal (Esc)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Language Tabs & Action Bar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-850 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Language Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setSelectedLanguage(lang.id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  selectedLanguage === lang.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition duration-150 active:scale-95 cursor-pointer border ${
              copied
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700/80 hover:text-white'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Area */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-950/80 font-mono text-xs">
          <pre className="text-slate-200 leading-relaxed overflow-x-auto selection:bg-indigo-500/30 selection:text-indigo-200">
            <code>{snippet}</code>
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Environment placeholders like <code className="text-indigo-300">{"{{variable}}"}</code> are preserved for secret safety</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-md text-xs font-medium transition cursor-pointer border border-slate-700/60"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CodeSnippetModal(props: CodeSnippetModalProps) {
  if (!props.isOpen) return null;
  return <CodeSnippetModalContent {...props} />;
}
