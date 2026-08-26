
interface ResponsePanelProps {
  response: {
    status: number;
    statusText: string;
    time: number;
    size: number;
    body: string;
  } | null;
  isSending: boolean;
}

export default function ResponsePanel({ response, isSending }: ResponsePanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col min-h-[220px] overflow-hidden">
      {/* Response Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 select-none">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
          <span>Response</span>
          {isSending && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          )}
        </h2>

        {/* Response Metrics (visible only if there is a response) */}
        {response && (
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className="text-slate-500">Status:</span>
              <span className={response.status >= 200 && response.status < 300 ? 'text-emerald-400 font-bold' : 'text-rose-450 font-bold'}>
                {response.status} {response.statusText}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className="text-slate-500">Time:</span>
              <span className="text-amber-400 font-medium">{response.time}ms</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              <span className="text-slate-500">Size:</span>
              <span className="text-sky-400 font-medium">{response.size} B</span>
            </div>
          </div>
        )}
      </div>

      {/* Response Body Inspector */}
      <div className="flex-1 flex flex-col justify-center overflow-auto min-h-0">
        {isSending ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-xs text-slate-500 font-medium animate-pulse">Request in transit...</p>
          </div>
        ) : response ? (
          <div className="flex-1 bg-slate-950 rounded-lg border border-slate-850 p-3 font-mono text-xs text-indigo-350 overflow-auto max-h-[350px]">
            <pre className="text-left whitespace-pre-wrap select-text">
              {JSON.stringify(JSON.parse(response.body), null, 2)}
            </pre>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center border border-slate-850/80">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-400">
                Send a request to see the response
              </p>
              <p className="text-[11px] text-slate-650 max-w-[280px] mt-1 mx-auto">
                Select an HTTP method, type a URL address above, and hit the Send button.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
