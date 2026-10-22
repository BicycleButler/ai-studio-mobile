import { useSyncExternalStore, useEffect, useCallback } from "react";
import { IThemeService } from "../services/themeService";

import { useServices } from "../services/ServiceContext";
export function useTheme(customThemeService?: IThemeService) {
  const { themeService: contextThemeService } = useServices();
  const themeService = customThemeService || contextThemeService;
  useEffect(() => {
    return themeService.initThemeService();
  }, [themeService]);

  const subscribe = useCallback((listener: () => void) => {
    return themeService.subscribeToTheme(() => listener());
  }, [themeService]);

  const getSnapshot = useCallback(() => {
    return themeService.getThemeState();
  }, [themeService]);

  const themeState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    mode: themeState.mode,
    resolvedTheme: themeState.resolvedTheme,
    setThemeMode: themeService.setThemeMode.bind(themeService),
    toggleTheme: themeService.toggleTheme.bind(themeService),
  };
}
