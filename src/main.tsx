import { BrowserPlatformService } from "./services/platformService";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';


import { FirebaseAuthProvider } from './services/firebaseAuthProvider';



import { ServiceProvider, createServices } from './services/ServiceContext';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary';
import { pwaUpdateManager } from './utils/pwaUpdate';
import { errorReporter } from './utils/errorReporter';

const appServices = createServices();

// Capture uncaught synchronous errors and unhandled promise rejections in bounded ring buffer
if (appServices.platformService.isBrowserEnv()) {
  appServices.platformService.addEventListener('error', (evt: Event) => {
    const errEvt = evt as ErrorEvent;
    errorReporter.report('unhandled_error', errEvt.message || 'Uncaught window error', {
      scope: 'window',
    });
  });
  appServices.platformService.addEventListener('unhandledrejection', (evt: Event) => {
    const rejEvt = evt as PromiseRejectionEvent;
    const reason = rejEvt.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
    errorReporter.report('unhandled_error', msg, {
      scope: 'promise',
    });
  });
}

// Initialize auth provider through dependency injection
appServices.googleAuthService.setAuthProvider(new FirebaseAuthProvider(appServices.logger));

// Initialize core services on startup
appServices.chatHistoryService.purgeMockSessionsFromStorage();

// Initialize theme immediately on startup to prevent theme flash
appServices.themeService.initThemeService();

// Initialize sync handlers
appServices.syncOrchestrator.registerHandlers();

// Register PWA service worker with user-controlled update prompt
if (new BrowserPlatformService().isBrowserEnv() && 'serviceWorker' in (new BrowserPlatformService().getNavigator() || {})) {
  const updateSW = registerSW({
    onNeedRefresh() {
      pwaUpdateManager.markNeedRefresh();
    },
    onOfflineReady() {
      pwaUpdateManager.markOfflineReady();
    },
    onRegisterError(error: unknown) {
      appServices.logger.warn("Service worker registration failed:", error);
      pwaUpdateManager.markRegisterError(error);
    },
  });
  pwaUpdateManager.setUpdateFn(updateSW);
}

createRoot(new BrowserPlatformService().getDocument()!.getElementById('root')!).render(
  <StrictMode>
    <ServiceProvider services={appServices}>
      <ErrorBoundary scope="application">
        <App />
      </ErrorBoundary>
    </ServiceProvider>
  </StrictMode>,
);
