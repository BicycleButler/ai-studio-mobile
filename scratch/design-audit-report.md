# Design System Compliance Audit Report

**Date:** 2026-11-15T18:09:36.336Z
**Target Directory:** `src`
**Total Files Audited:** 288
**Clean Files:** 282 (97.9%)
**Files with Violations:** 6
**Total Violations Detected:** 9

## Violation Breakdown by Rule

| Rule | ADR | Count |
|---|---|---|
| Semantic Color at Rest | ADR 0036 §1 | 5 |
| Static Alert Colors | ADR 0020 | 2 |
| Raw Emoji in Functional UI | ADR 0021 | 2 |

## Violation Breakdown by Directory

| Directory | Violations | Status |
|---|---|---|
| `components/MobileIDEWorkspace.tsx` | 2 | ⚠️ Needs Review |
| `components/StorageWarningBanner.tsx` | 2 | ⚠️ Needs Review |
| `utils/storage` | 2 | ⚠️ Needs Review |
| `components/ErrorBoundary.tsx` | 1 | ⚠️ Needs Review |
| `components/IDEFileExplorerSidebar.tsx` | 1 | ⚠️ Needs Review |
| `components/OfflineIndicator.tsx` | 1 | ⚠️ Needs Review |

## Detailed Violation Log

- **[ERROR]** `src/components/ErrorBoundary.tsx:64` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
  ```
- **[ERROR]** `src/components/IDEFileExplorerSidebar.tsx:313` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <div className="px-2.5 py-2 text-xs text-destructive space-y-1.5">
  ```
- **[ERROR]** `src/components/MobileIDEWorkspace.tsx:794` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <span className="text-[11px] text-destructive font-mono truncate">
  ```
- **[ERROR]** `src/components/MobileIDEWorkspace.tsx:872` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <p className="text-xs font-mono text-destructive">{workspaceFileError}</p>
  ```
- **[ERROR]** `src/components/OfflineIndicator.tsx:25` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  className="sticky top-0 z-[100] w-full flex items-center justify-between gap-2 px-4 py-2 bg-destructive/10 text-destructive border-b border-destructive/30 text-xs font-medium"
  ```
- **[WARNING]** `src/components/StorageWarningBanner.tsx:18` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  className="mx-3 mt-2 flex items-center justify-between gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground shadow-sm"
  ```
- **[WARNING]** `src/components/StorageWarningBanner.tsx:21` — **Static Alert Colors** (ADR 0020): Static alert color on resting UI element. Restrict colored alerts to transient states or active hover.
  ```tsx
  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
  ```
- **[WARNING]** `src/utils/storage/encryption.test.ts:16` — **Raw Emoji in Functional UI** (ADR 0021): Raw unicode emoji used in functional UI. Replace with Lucide icon.
  ```tsx
  const secret = 'key-🔐-日本語-café-Δ';
  ```
- **[WARNING]** `src/utils/storage/encryption.test.ts:23` — **Raw Emoji in Functional UI** (ADR 0021): Raw unicode emoji used in functional UI. Replace with Lucide icon.
  ```tsx
  const plain = 'v2_key_🔒';
  ```
