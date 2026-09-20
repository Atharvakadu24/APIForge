import { useState, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Environment } from '../types/environment';

interface HeaderProps {
  environments?: Environment[];
  activeEnvironmentId?: string | null;
  onSelectEnvironment?: (id: string | null) => void;
  onOpenEnvironmentManager?: () => void;
  onOpenCommandPalette?: () => void;
  user?: User | null;
  onSignOut?: () => void;
}

export default function Header({
  environments = [],
  activeEnvironmentId = null,
  onSelectEnvironment,
  onOpenEnvironmentManager,
  onOpenCommandPalette,
  user = null,
  onSignOut,
}: HeaderProps) {
  const [isEnvDropdownOpen, setIsEnvDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const envDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        envDropdownRef.current &&
        !envDropdownRef.current.contains(e.target as Node)
      ) {
        setIsEnvDropdownOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute initials from user email
  const getUserInitials = (emailStr?: string | null) => {
    if (!emailStr) return 'AF';
    const parts = emailStr.split('@')[0].split(/[._-]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return emailStr.substring(0, 2).toUpperCase();
  };

  const userEmail = user?.email || 'developer@apiforge.dev';
  const userInitials = getUserInitials(user?.email);

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
          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Personal Workspace</span>
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Middle section: Search placeholder / Command Palette trigger */}
      <div className="hidden md:flex items-center max-w-sm w-80">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-slate-500 hover:text-slate-400 px-3 py-1.5 rounded-lg text-xs transition duration-150 cursor-pointer"
        >
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

      {/* Right section: Environment Selector & User Profile */}
      <div className="flex items-center space-x-3">
        {/* Environment Selector Dropdown */}
        <div className="relative" ref={envDropdownRef}>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setIsEnvDropdownOpen(!isEnvDropdownOpen)}
              className="flex items-center space-x-2 px-2.5 py-1 rounded text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-850/80 transition cursor-pointer"
            >
              <span className={`w-2 h-2 rounded-full ${activeEnv ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50' : 'bg-slate-600'}`} />
              <span className="font-medium max-w-[120px] truncate">
                {activeEnv ? activeEnv.name : 'No Environment'}
              </span>
              <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Quick-open Environment Manager button */}
            <button
              type="button"
              onClick={onOpenEnvironmentManager}
              className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-800/80 rounded transition cursor-pointer"
              title="Manage Environments & Variables"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Environment Dropdown Menu */}
          {isEnvDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-fade-in">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Environment
              </div>

              {/* No Environment option */}
              <button
                type="button"
                onClick={() => {
                  onSelectEnvironment?.(null);
                  setIsEnvDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800 transition cursor-pointer ${
                  !activeEnvironmentId ? 'text-indigo-400 font-semibold bg-slate-800/40' : 'text-slate-300'
                }`}
              >
                <span>No Environment</span>
                {!activeEnvironmentId && <span className="text-indigo-400 font-bold">✓</span>}
              </button>

              <div className="h-px bg-slate-800 my-1" />

              {/* Environment List */}
              {environments.map((env) => {
                const isSelected = env.id === activeEnvironmentId;
                return (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => {
                      onSelectEnvironment?.(env.id);
                      setIsEnvDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-slate-800 transition cursor-pointer ${
                      isSelected ? 'text-indigo-400 font-semibold bg-slate-800/40' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{env.name}</span>
                    {isSelected && <span className="text-indigo-400 font-bold">✓</span>}
                  </button>
                );
              })}

              <div className="h-px bg-slate-800 my-1" />

              {/* Manage Environments action */}
              <button
                type="button"
                onClick={() => {
                  setIsEnvDropdownOpen(false);
                  onOpenEnvironmentManager?.();
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 transition cursor-pointer font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Manage Environments...</span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-800" />

        {/* User Profile & Logout Area */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-800/80 transition cursor-pointer"
            title={`Signed in as ${userEmail}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-[10px] shadow-sm ring-1 ring-slate-700/80">
              {userInitials}
            </div>
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User Popover Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs animate-fade-in divide-y divide-slate-800/80">
              {/* User info header */}
              <div className="px-3.5 py-2.5">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 font-semibold truncate" title={userEmail}>
                      {userEmail}
                    </p>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-slate-400 font-mono">Supabase Auth</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign out action */}
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onSignOut?.();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition cursor-pointer font-semibold text-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
