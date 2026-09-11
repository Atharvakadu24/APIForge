export default function LoadingScreen() {
  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center select-none text-slate-100">
      <div className="flex flex-col items-center space-y-4">
        {/* Animated Brand Logo */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center font-extrabold text-white text-xl shadow-xl shadow-indigo-500/20 animate-pulse">
            AF
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 opacity-30 blur-md animate-ping" />
        </div>

        {/* Text and Spinner */}
        <div className="flex flex-col items-center space-y-2">
          <h2 className="text-sm font-bold tracking-wider text-slate-200">APIForge</h2>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Resolving workspace session...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
