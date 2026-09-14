---
title: "Theme System Architecture & Theme Service Specification"
type: service-spec
status: materialized
target_code_file: src/services/themeService.ts
version: 1.0.0
tags:
  - theme
  - dark-mode
  - light-mode
  - oklch
  - color-system
  - adr-0020
  - adr-0028
  - adr-0041
---

# Theme System Architecture & Theme Service Specification

## 1. Architectural Responsibility
Provides system-wide theme lifecycle management, dynamic stylesheet token injection, persistence, and reactive theme mode toggling (light / dark / system) for Google AI Studio Mobile in accordance with:
- **ADR 0020 (Color System Architecture):** OKLCH perceptual model (`oklch()`), 3-seed derivation, two-tier token hierarchy, dynamic-only semantic status colors, zero static semantic alert colors at rest.
- **ADR 0028 (Theming & Dark Mode):** Strict token manifest contract, 4-tier dark mode z-index lightness progression (Layer 0 Canvas -> Layer 1 Frame -> Layer 2 Cards -> Layer 3 Modals/Popovers with 4%–6% lightness contrast delta), system `prefers-color-scheme` synchronization, and local storage override persistence.
- **ADR 0041 (Surface Tier System):** 5-tier elevation shadow scale and borderless resting surfaces.

## 2. Design Tree & Frontier Status
- [x] Round 1 - Q1 (CSS Token Architecture & Tailwind v4 Integration): Option A (OKLCH CSS Custom Properties + @theme mapping in src/index.css)
- [x] Round 1 - Q2 (Default Theme Palettes & Base Seeds): Option A (Minimal Slate Blue Light Theme & Google Deep AI Studio 4-tier elevation Dark Theme)
- [x] Round 1 - Q3 (Theme Modes & Resolution Strategy): Option A (Dedicated singleton themeService.ts + useTheme hook + localStorage persistence under 'aistudio_theme_mode')
- [x] Round 1 - Q4 (Hardcoded Color Eradication & Semantic Token Mapping): Option A (Comprehensive sweep across all components to semantic tokens)
- [x] Round 1 - Q5 (Theme Switcher UI Placement & Touch Targets): Option A (Dual entry: TopAppBar quick toggle + UnifiedSettingsModal Display tab 3-way segmented control)

## 3. Data Interface Contracts

```typescript
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeConfig {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

export interface ThemeListener {
  (config: ThemeConfig): void;
}

export interface ThemeServiceContract {
  getThemeMode(): ThemeMode;
  getResolvedTheme(): ResolvedTheme;
  setThemeMode(mode: ThemeMode): void;
  toggleTheme(): void;
  subscribe(listener: ThemeListener): () => void;
  initTheme(): () => void;
}
```

## 4. Semantic OKLCH Token Contract (ADR 0020 / ADR 0028)
```css
/* Tier 1 Palettes & Tier 2 Semantic Tokens mapped to Tailwind */
--background          /* Canvas base: Layer 0 */
--surface-frame       /* Frame/Workspace outer: Layer 1 */
--card                /* Cards & input panels: Layer 2 */
--popover             /* Modals, bottom sheets, popovers: Layer 3 */
--foreground          /* High-contrast body & header text (WCAG AAA/AA) */
--muted-foreground    /* Secondary metadata, captions, timestamps */
--subtle-foreground   /* Placeholder, disabled, decorative labels */
--border              /* Structural dividing strokes */
--border-subtle       /* Internal resting element dividers */
--input               /* Input containers & toggles */
--ring                /* Focus outline rings */
--primary             /* Brand CTA / active selection */
--primary-foreground  /* Contrast text on primary */
--secondary           /* Subdued secondary actions */
--secondary-foreground/* Contrast text on secondary */
--accent              /* Hover highlights & active tab indicator */
--accent-foreground   /* Contrast text on accent */
--destructive         /* Ephemeral destructive action (modal confirm/toast) */
--destructive-foreground
--success             /* Ephemeral success feedback */
--success-foreground
--warning             /* Ephemeral warning alert */
--warning-foreground
```
