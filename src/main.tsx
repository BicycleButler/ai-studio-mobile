import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initThemeService } from './services/themeService';
import { registerSW } from 'virtual:pwa-register';

// Initialize theme immediately on startup to prevent theme flash
initThemeService();

// Register PWA service worker with auto-update
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
