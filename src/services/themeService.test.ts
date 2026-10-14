import { describe, test } from 'vitest';
import {
  setThemeMode,
  toggleTheme,
  getThemeState,
  loadStoredThemeMode,
  persistThemeMode,
  resolveTheme,
} from "./themeService";

describe('testThemeService', () => {
  test('main', () => {
  // Test resolveTheme
  if (resolveTheme("light") !== "light") {
    throw new Error("Expected resolveTheme('light') to return 'light'");
  }
  if (resolveTheme("dark") !== "dark") {
    throw new Error("Expected resolveTheme('dark') to return 'dark'");
  }

  // Test persist and load
  persistThemeMode("light");
  if (loadStoredThemeMode() !== "light") {
    throw new Error("Expected loadStoredThemeMode() to return 'light'");
  }

  persistThemeMode("dark");
  if (loadStoredThemeMode() !== "dark") {
    throw new Error("Expected loadStoredThemeMode() to return 'dark'");
  }

  // Test setThemeMode
  setThemeMode("light");
  let state = getThemeState();
  if (state.mode !== "light" || state.resolvedTheme !== "light") {
    throw new Error(`Expected light mode, got ${state.mode} / ${state.resolvedTheme}`);
  }

  // Test toggleTheme
  toggleTheme();
  state = getThemeState();
  if (state.mode !== "dark" || state.resolvedTheme !== "dark") {
    throw new Error(`Expected dark mode after toggle, got ${state.mode} / ${state.resolvedTheme}`);
  }

  toggleTheme();
  state = getThemeState();
  if (state.mode !== "light" || state.resolvedTheme !== "light") {
    throw new Error(`Expected light mode after second toggle, got ${state.mode} / ${state.resolvedTheme}`);
  }

  // Reset to dark or system for test consistency
  setThemeMode("dark");


  });
});
