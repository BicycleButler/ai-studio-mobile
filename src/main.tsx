import { isBrowserEnvironment } from "./utils/platform";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';


import { FirebaseAuthProvider } from './services/firebaseAuthProvider';



import { ServiceProvider, createServices } from './services/ServiceContext';
import { registerSW } from 'virtual:pwa-register';









const appServices = createServices();

// Initialize auth provider via dependency injection
appServices.googleAuthService.setAuthProvider(new FirebaseAuthProvider());

// Initialize core services on startup
appServices.chatHistoryService.purgeMockSessionsFromStorage();

// Initialize theme immediately on startup to prevent theme flash
appServices.themeService.initThemeService();

// Initialize sync handlers
appServices.syncOrchestrator.registerHandlers();

// Register PWA service worker with auto-update
if (isBrowserEnvironment() && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServiceProvider services={appServices}>

      <App />

    </ServiceProvider>
  </StrictMode>,
);
