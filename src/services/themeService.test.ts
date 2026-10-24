import { ThemeService } from "./themeService";
import { describe, test } from 'vitest';
import {
} from "./themeService";

describe('testThemeService', () => {
  test('main', () => {
  const themeService = new ThemeService();
  // Test resolveTheme
  if (themeService.resolveTheme("light") !== "light") {
    throw new Error("Expected themeService.resolveTheme('light') to return 'light'");
  }
  if (themeService.resolveTheme("dark") !== "dark") {
    throw new Error("Expected themeService.resolveTheme('dark') to return 'dark'");
  }

  // Test persist and load
  themeService.persistThemeMode("light");
  if (themeService.loadStoredThemeMode() !== "light") {
    throw new Error("Expected themeService.loadStoredThemeMode() to return 'light'");
  }

  themeService.persistThemeMode("dark");
  if (themeService.loadStoredThemeMode() !== "dark") {
    throw new Error("Expected themeService.loadStoredThemeMode() to return 'dark'");
  }

  // Test setThemeMode
  themeService.setThemeMode("light");
  let state = themeService.getThemeState();
  if (state.mode !== "light" || state.resolvedTheme !== "light") {
    throw new Error(`Expected light mode, got ${state.mode} / ${state.resolvedTheme}`);
  }

  // Test toggleTheme
  themeService.toggleTheme();
  state = themeService.getThemeState();
  if (state.mode !== "dark" || state.resolvedTheme !== "dark") {
    throw new Error(`Expected dark mode after toggle, got ${state.mode} / ${state.resolvedTheme}`);
  }

  themeService.toggleTheme();
  state = themeService.getThemeState();
  if (state.mode !== "light" || state.resolvedTheme !== "light") {
    throw new Error(`Expected light mode after second toggle, got ${state.mode} / ${state.resolvedTheme}`);
  }

  // Reset to dark or system for test consistency
  themeService.setThemeMode("dark");


  });
});
