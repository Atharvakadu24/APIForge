
export default function Header() {
  return (
    <header className="h-12 border-b border-slate-800 bg-slate-900 px-4 flex items-center justify-between select-none shrink-0 z-50">
      {/* Left section: Logo & Workspace */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-indigo-500/10">
            AF
          </div>
          <span className="font-extrabold text-sm tracking-wider text-slate-100">
            APIForge
          </span>
        </div>
        
        <div className="h-4 w-px bg-slate-800" />
        
        {/* Workspace selector */}
        <div className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded transition text-xs text-slate-300 font-medium">
          <svg className="w-3.5 h-3.5 text-indigo-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Personal Workspace</span>
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Middle section: Search placeholder */}
      <div className="hidden md:flex items-center max-w-sm w-80">
        <button className="w-full flex items-center justify-between bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-500 hover:text-slate-400 px-3 py-1.5 rounded-lg text-xs transition duration-150">
          <div className="flex items-center space-x-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search requests or docs...</span>
          </div>
          <kbd className="bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded text-[10px] text-slate-450 font-mono tracking-widest">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right section: Settings & User Profile */}
      <div className="flex items-center space-x-3">
        {/* Settings button */}
        <button className="p-1.5 text-slate-450 hover:text-slate-200 hover:bg-slate-800 rounded transition duration-150" title="Settings">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-800" />

        {/* User avatar */}
        <div className="flex items-center space-x-2">
          <div className="w-6.5 h-6.5 rounded-full bg-indigo-650 hover:bg-indigo-600 transition flex items-center justify-center font-bold text-white text-[10px] cursor-pointer ring-1 ring-slate-800">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
