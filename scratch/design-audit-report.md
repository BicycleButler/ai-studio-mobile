# Design System Compliance Audit Report

**Date:** 2026-09-20T16:55:13.724Z
**Target Directory:** `src`
**Total Files Audited:** 70
**Clean Files:** 64 (91.4%)
**Files with Violations:** 6
**Total Violations Detected:** 24

## Violation Breakdown by Rule

| Rule | ADR | Count |
|---|---|---|
| transition:all Banned | ADR 0022 | 10 |
| Status Dot Deprecation | ADR 0035 | 2 |
| Static Alert Colors | ADR 0020 | 10 |
| Semantic Color at Rest | ADR 0036 §1 | 2 |

## Violation Breakdown by Directory

| Directory | Violations | Status |
|---|---|---|
| `components/ChatWorkspace.tsx` | 13 | ⚠️ Needs Review |
| `components/TunerBottomSheet.tsx` | 3 | ⚠️ Needs Review |
| `components/UnifiedSettingsModal.tsx` | 3 | ⚠️ Needs Review |
| `components/MobileIDEWorkspace.tsx` | 2 | ⚠️ Needs Review |
| `components/OfflineIndicator.tsx` | 2 | ⚠️ Needs Review |
| `components/PWAInstallButton.tsx` | 1 | ⚠️ Needs Review |

## Detailed Violation Log

- **[WARNING]** `src/components/ChatWorkspace.tsx:1030` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className={`w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl transition-all cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation ${
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1083` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1633` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className="h-12 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl flex items-center gap-2.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer touch-manipulation group"
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1641` — **Status Dot Deprecation** (ADR 0035): Colored status dots are deprecated. Use Concept C sub-label stacking.
  ```tsx
  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1720` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <span className="w-1 bg-emerald-500 rounded-full animate-pulse h-5" />
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1721` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <span className="w-1 bg-emerald-500 rounded-full animate-pulse [animation-delay:0.2s] h-3.5" />
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1722` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <span className="w-1 bg-emerald-500 rounded-full animate-pulse [animation-delay:0.4s] h-5" />
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1743` — **Status Dot Deprecation** (ADR 0035): Colored status dots are deprecated. Use Concept C sub-label stacking.
  ```tsx
  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1745` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1751` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <p className="text-[11px] text-amber-500 dark:text-amber-400 font-medium truncate">
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:1799` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className={`w-full bg-background border-t border-border transition-all duration-600 ease-in-out flex ${
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:2006` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  } h-20 min-h-[80px] bg-background hover:bg-muted/30 focus-visible:border-primary px-4 py-3 flex flex-col justify-center cursor-pointer transition-all duration-600 ease-in-out select-none group touch-manipulation`}
  ```
- **[WARNING]** `src/components/ChatWorkspace.tsx:2030` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className="flex-1 w-1/2 h-20 min-h-[80px] bg-gradient-to-br from-primary/15 via-primary/10 to-primary/20 hover:from-primary/25 hover:via-primary/15 hover:to-primary/25 active:scale-[0.99] text-primary flex items-center justify-center transition-all duration-300 ease-in-out cursor-pointer touch-manipulation group"
  ```
- **[WARNING]** `src/components/MobileIDEWorkspace.tsx:411` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer whitespace-nowrap group shrink-0 border select-none ${
  ```
- **[ERROR]** `src/components/MobileIDEWorkspace.tsx:783` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  if (log.type === "stderr") color = "text-destructive font-medium";
  ```
- **[WARNING]** `src/components/OfflineIndicator.tsx:26` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  className="fixed bottom-16 sm:bottom-4 left-3 sm:left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-600/95 text-white shadow-lg border border-amber-400/40 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
  ```
- **[WARNING]** `src/components/OfflineIndicator.tsx:40` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  className="fixed bottom-16 sm:bottom-4 left-3 sm:left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/95 text-white shadow-lg border border-emerald-400/40 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
  ```
- **[ERROR]** `src/components/PWAInstallButton.tsx:24` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-medium">
  ```
- **[WARNING]** `src/components/TunerBottomSheet.tsx:230` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className={`text-left p-3 rounded-xl border transition-all relative cursor-pointer group ${
  ```
- **[WARNING]** `src/components/TunerBottomSheet.tsx:522` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  schemaStatus.valid ? "text-emerald-500" : "text-rose-500"
  ```
- **[WARNING]** `src/components/TunerBottomSheet.tsx:645` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  ```
- **[WARNING]** `src/components/UnifiedSettingsModal.tsx:1395` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <div className="mt-0.5 p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
  ```
- **[WARNING]** `src/components/UnifiedSettingsModal.tsx:1403` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
  ```
- **[WARNING]** `src/components/UnifiedSettingsModal.tsx:2117` — **transition:all Banned** (ADR 0022): `transition: all` is a forbidden pattern — animates unintended properties. Use specific transition properties.
  ```tsx
  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  ```
