import { defaultThemeService } from "./themeService";
import { describe, test } from 'vitest';
import {
} from "./themeService";

describe('testThemeService', () => {
  test('main', () => {
  // Test resolveTheme
  if (defaultThemeService.resolveTheme("light") !== "light") {
    throw new Error("Expected defaultThemeService.resolveTheme('light') to return 'light'");
  }
  if (defaultThemeService.resolveTheme("dark") !== "dark") {
    throw new Error("Expected defaultThemeService.resolveTheme('dark') to return 'dark'");
  }

  // Test persist and load
  defaultThemeService.persistThemeMode("light");
  if (defaultThemeService.loadStoredThemeMode() !== "light") {
    throw new Error("Expected defaultThemeService.loadStoredThemeMode() to return 'light'");
  }

  defaultThemeService.persistThemeMode("dark");
  if (defaultThemeService.loadStoredThemeMode() !== "dark") {
    throw new Error("Expected defaultThemeService.loadStoredThemeMode() to return 'dark'");
  }

  // Test setThemeMode
  defaultThemeService.setThemeMode("light");
  let state = defaultThemeService.getThemeState();
  if (state.mode !== "light" || state.resolvedTheme !== "light") {
    throw new Error(`Expected light mode, got ${state.mode} / ${state.resolvedTheme}`);
  }

  // Test toggleTheme
  defaultThemeService.toggleTheme();
  state = defaultThemeService.getThemeState();
  if (state.mode !== "dark" || state.resolvedTheme !== "dark") {
    throw new Error(`Expected dark mode after toggle, got ${state.mode} / ${state.resolvedTheme}`);
  }

  defaultThemeService.toggleTheme();
  state = defaultThemeService.getThemeState();
  if (state.mode !== "light" || state.resolvedTheme !== "light") {
    throw new Error(`Expected light mode after second toggle, got ${state.mode} / ${state.resolvedTheme}`);
  }

  // Reset to dark or system for test consistency
  defaultThemeService.setThemeMode("dark");


  });
});
