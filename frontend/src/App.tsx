import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  uptime: number;
  timestamp: string;
  service: string;
}

function App() {
  const [backendHealth, setBackendHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      // In local dev, the backend runs on port 3001
      const response = await fetch('http://localhost:3001/api/health');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBackendHealth(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
      setBackendHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/25 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/25 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25 text-xl tracking-wider">
              AF
            </div>
            <div>
              <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                APIForge
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Status: Development</span>
          </div>
        </div>
      </header>

      {/* Hero Body */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20 flex-1 flex flex-col justify-center items-center text-center relative z-10">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            APIForge
          </span>
        </h1>
        <p className="text-xl md:text-2xl font-medium text-slate-300 mb-2">
          API Testing & Debugging Platform
        </p>
        <p className="text-slate-400 max-w-lg mb-8 text-sm md:text-base">
          A full-stack suite built from scratch to compose, execute, and analyze HTTP requests. Designed for optimal speed and reliability.
        </p>

        {/* Info & Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-12">
          {/* Phase Card */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-6 text-left hover:border-slate-800 transition duration-300 backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Current Phase</h3>
            <h4 className="text-lg font-bold text-slate-200 mb-1">Phase 0: Initialization</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Scaffolding the environment, laying out workspace structures, and establishing backend-to-frontend communication.
            </p>
          </div>

          {/* Backend Status Card */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-6 text-left hover:border-slate-800 transition duration-300 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Backend Connection</h3>
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${backendHealth ? 'bg-emerald-500 animate-pulse' : error ? 'bg-rose-500' : 'bg-slate-600'}`} />
                <span className="text-sm font-semibold text-slate-300">
                  {loading ? 'Checking...' : backendHealth ? 'Connected (Online)' : error ? 'Offline' : 'Disconnected'}
                </span>
              </div>
              {backendHealth && (
                <div className="text-xs font-mono text-slate-400 mt-2 space-y-1">
                  <div>Service: <span className="text-indigo-400">{backendHealth.service}</span></div>
                  <div>Uptime: <span className="text-indigo-400">{Math.round(backendHealth.uptime)}s</span></div>
                  <div>Status: <span className="text-emerald-400">{backendHealth.status}</span></div>
                </div>
              )}
              {error && (
                <p className="text-xs text-rose-400 mt-2 bg-rose-950/40 border border-rose-900/50 rounded-lg p-2 font-mono">
                  {error}
                </p>
              )}
            </div>

            <button
              onClick={checkHealth}
              disabled={loading}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-850 disabled:text-slate-600 text-slate-200 text-xs font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2 border border-slate-700 hover:border-slate-600"
            >
              {loading ? (
                <span>Retrying...</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.247 7H18" />
                  </svg>
                  <span>Test Connection</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tech Stack Pills */}
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Node.js', 'Express'].map((tech) => (
            <span
              key={tech}
              className="px-3 py-1 bg-slate-900 text-slate-300 rounded-full text-xs border border-slate-800 font-medium"
            >
              {tech}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 bg-slate-950 px-6 py-6 text-center text-xs text-slate-600 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
          <div>© {new Date().getFullYear()} APIForge. All rights reserved.</div>
          <div className="flex space-x-4">
            <span className="hover:text-slate-400 transition cursor-help">Documentation</span>
            <span className="hover:text-slate-400 transition cursor-help">Github</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
