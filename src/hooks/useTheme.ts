import { useState, useEffect } from "react";
import {
  ThemeState,
  getThemeState,
  setThemeMode,
  toggleTheme,
  subscribeToTheme,
  initThemeService,
} from "../services/themeService";

export function useTheme() {
  const [themeState, setState] = useState<ThemeState>(() => getThemeState());

  useEffect(() => {
    initThemeService();
    const unsubscribe = subscribeToTheme((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  return {
    mode: themeState.mode,
    resolvedTheme: themeState.resolvedTheme,
    setThemeMode,
    toggleTheme,
  };
}
