import { isBrowserEnvironment } from "./utils/platform";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { defaultThemeService } from './services/themeService';
import { defaultGoogleAuthService } from './services/googleAuth';
import { FirebaseAuthProvider } from './services/firebaseAuthProvider';
import { initializeChatHistoryService } from './services/chatHistoryService';

import { ServiceProvider } from './services/ServiceContext';
import { registerSW } from 'virtual:pwa-register';

// Initialize auth provider via dependency injection
defaultGoogleAuthService.setAuthProvider(new FirebaseAuthProvider());

// Initialize core services on startup
initializeChatHistoryService();
// Initialize theme immediately on startup to prevent theme flash
defaultThemeService.initThemeService();

// Register PWA service worker with auto-update
if (isBrowserEnvironment() && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServiceProvider>

      <App />

    </ServiceProvider>
  </StrictMode>,
);
