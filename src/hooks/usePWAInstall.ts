import { useCallback, useEffect } from "react";
import { useServices } from "../services/ServiceContext";
import { useStore } from "./useStore";

export function usePWAInstall() {
  const { pwaInstallService } = useServices();

  useEffect(() => {
    // Initialize listeners inside useEffect to prevent updating state during render
    pwaInstallService.initListeners();
  }, [pwaInstallService]);

  const state = useStore(pwaInstallService.stateObservable)!;

  const install = useCallback(async (): Promise<boolean> => {
    if (!state.deferredPrompt) return false;
    try {
      await state.deferredPrompt.prompt();
      const choiceResult = await state.deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        const current = pwaInstallService.stateObservable.getSnapshot()!;
        pwaInstallService.stateObservable.notify({ ...current, isInstalled: true, deferredPrompt: null });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [state.deferredPrompt, pwaInstallService]);

  return {
    isInstallable: Boolean(state.deferredPrompt),
    isInstalled: state.isInstalled,
    isIOS: state.isIOS,
    isCapacitor: state.isNativeCapacitor,
    install,
  };
}
