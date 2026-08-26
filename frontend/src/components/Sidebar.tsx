
// Mock collections data for UI layout
const mockCollections = [
  {
    id: 1,
    name: 'User Management API',
    requests: [
      { id: 'u1', method: 'GET', name: 'Get Profile' },
      { id: 'u2', method: 'POST', name: 'Update Account' },
    ],
  },
  {
    id: 2,
    name: 'Billing Service',
    requests: [
      { id: 'b1', method: 'GET', name: 'Fetch Invoices' },
      { id: 'b2', method: 'POST', name: 'Create Subscription' },
    ],
  },
];

// Mock history data for UI layout
const mockHistory = [
  { id: 'h1', method: 'GET', url: '/api/health', status: 200 },
  { id: 'h2', method: 'POST', url: '/api/v1/auth/login', status: 201 },
  { id: 'h3', method: 'GET', url: '/api/v1/users', status: 200 },
  { id: 'h4', method: 'DELETE', url: '/api/v1/posts/42', status: 404 },
];

export default function Sidebar() {
  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-emerald-400 bg-emerald-950/45';
      case 'POST': return 'text-sky-400 bg-sky-950/45';
      case 'PUT': return 'text-amber-400 bg-amber-950/45';
      case 'DELETE': return 'text-rose-400 bg-rose-950/45';
      default: return 'text-slate-400 bg-slate-900';
    }
  };

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-sm flex flex-col app-height select-none shrink-0 overflow-hidden">
      {/* New Request Button */}
      <div className="p-3">
        <button className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition duration-200 shadow-md shadow-indigo-500/10">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Request</span>
        </button>
      </div>

      <div className="h-px bg-slate-850 mx-3" />

      {/* Main navigation / lists */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {/* Collections Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Collections</span>
            <button className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          <div className="space-y-1">
            {mockCollections.map((col) => (
              <div key={col.id} className="space-y-0.5">
                {/* Folder Header */}
                <div className="flex items-center space-x-1.5 px-2 py-1 hover:bg-slate-800/80 rounded-md cursor-pointer transition text-xs text-slate-300 font-medium">
                  <svg className="w-3.5 h-3.5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate">{col.name}</span>
                </div>

                {/* Sub Requests */}
                <div className="pl-6 space-y-0.5">
                  {col.requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center space-x-2 px-2 py-0.5 hover:bg-slate-800/60 rounded cursor-pointer transition text-[11px] text-slate-400 group"
                    >
                      <span className={`text-[8px] font-bold font-mono px-1 rounded ${getMethodBadgeColor(req.method)}`}>
                        {req.method}
                      </span>
                      <span className="truncate group-hover:text-slate-300">{req.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* History Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">History</span>
            <button className="text-[9px] font-semibold text-slate-500 hover:text-slate-300 transition">
              Clear
            </button>
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {mockHistory.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-2 py-1 hover:bg-slate-800/50 rounded cursor-pointer transition text-[11px]"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className={`text-[8px] font-bold font-mono px-1 rounded ${getMethodBadgeColor(item.method)}`}>
                    {item.method}
                  </span>
                  <span className="font-mono text-slate-400 truncate">{item.url}</span>
                </div>
                <span className={`text-[9px] font-mono font-medium ${item.status >= 200 && item.status < 300 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Footer info */}
      <div className="p-3 border-t border-slate-850 text-[10px] text-slate-500 font-medium">
        <span>Vite-TS Environment</span>
      </div>
    </aside>
  );
}
