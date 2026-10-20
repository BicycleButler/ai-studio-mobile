import { useSyncExternalStore, useEffect } from "react";
import {
  getThemeState,
  setThemeMode,
  toggleTheme,
  subscribeToTheme,
  initThemeService,
} from "../services/themeService";

export function useTheme() {
  useEffect(() => {
    return initThemeService();
  }, []);

  const themeState = useSyncExternalStore(subscribeToTheme, getThemeState, getThemeState);

  return {
    mode: themeState.mode,
    resolvedTheme: themeState.resolvedTheme,
    setThemeMode,
    toggleTheme,
  };
}
