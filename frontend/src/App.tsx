import { useState } from 'react';
import AppShell from './components/AppShell';
import RequestEditor from './components/RequestEditor';
import ResponsePanel from './components/ResponsePanel';
import type { ApiRequest, HttpMethod } from './types/request';

interface ResponseData {
  status: number;
  statusText: string;
  time: number;
  size: number;
  body: string;
}

function App() {
  const [request, setRequest] = useState<ApiRequest>({
    method: 'GET',
    url: 'http://localhost:3001/api/health',
    queryParams: [],
    headers: [],
    body: '',
    auth: {
      type: 'none'
    }
  });
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);

  const setMethod = (method: HttpMethod) => {
    setRequest((prev) => ({ ...prev, method }));
  };

  const setUrl = (url: string) => {
    setRequest((prev) => ({ ...prev, url }));
  };

  const handleSend = async () => {
    setIsSending(true);
    setResponse(null);
    const startTime = performance.now();
    try {
      // In local dev, if requesting the health endpoint, we run a real API call!
      if (request.url.includes('/api/health')) {
        const res = await fetch('http://localhost:3001/api/health');
        const text = await res.text();
        const endTime = performance.now();
        setResponse({
          status: res.status,
          statusText: res.statusText,
          time: Math.round(endTime - startTime),
          size: new Blob([text]).size,
          body: text,
        });
      } else {
        // Fallback mock response for layout testing
        await new Promise((resolve) => setTimeout(resolve, 600));
        const mockBody = JSON.stringify({
          message: "APIForge Mock Response",
          method: request.method,
          url: request.url,
          tip: "Phase 1 implements layout, shell, and tab controls. Real execution of remote APIs will be added in Phase 2. Try sending to http://localhost:3001/api/health for a real backend hit!"
        });
        const endTime = performance.now();
        setResponse({
          status: 200,
          statusText: "OK",
          time: Math.round(endTime - startTime),
          size: new Blob([mockBody]).size,
          body: mockBody,
        });
      }
    } catch (err: any) {
      const endTime = performance.now();
      const errBody = JSON.stringify({
        error: "Failed to connect to backend",
        message: err.message,
        suggestion: "Ensure the backend Node/Express server is active at port 3001."
      });
      setResponse({
        status: 500,
        statusText: "Connection Refused",
        time: Math.round(endTime - startTime),
        size: new Blob([errBody]).size,
        body: errBody,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppShell>
      {/* Centered Workspace layout */}
      <div className="max-w-5xl w-full mx-auto flex flex-col space-y-4 h-full">
        {/* Development Status banner (inline to fit shell) */}
        <div className="bg-slate-900/40 border border-slate-850 px-4 py-2 rounded-lg flex items-center justify-between text-xs text-slate-400 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold text-slate-350">Status: Development Mode</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Phase 1: Shell & Layout</span>
        </div>

        {/* Workspace Panels (Request Editor + Response Inspector) */}
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden min-h-0">
          <RequestEditor
            method={request.method}
            setMethod={setMethod}
            url={request.url}
            setUrl={setUrl}
            onSend={handleSend}
            isSending={isSending}
          />
          
          <ResponsePanel
            response={response}
            isSending={isSending}
          />
        </div>
      </div>
    </AppShell>
  );
}

export default App;
