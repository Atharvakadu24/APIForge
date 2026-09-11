import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { verifySupabaseConnection } from './lib/supabase'

// Non-destructive Supabase client connection verification in development
if (import.meta.env.DEV) {
  verifySupabaseConnection().then((result) => {
    if (result.success) {
      console.log(`%c[APIForge Supabase] ${result.message}`, 'color: #10b981; font-weight: bold;');
    } else {
      console.warn(`%c[APIForge Supabase] ${result.message}`, 'color: #f59e0b; font-weight: bold;', result.error);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

