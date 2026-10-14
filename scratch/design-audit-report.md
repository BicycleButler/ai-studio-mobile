# Design System Compliance Audit Report

**Date:** 2026-10-14T17:57:11.687Z
**Target Directory:** `src`
**Total Files Audited:** 91
**Clean Files:** 90 (98.9%)
**Files with Violations:** 1
**Total Violations Detected:** 10

## Violation Breakdown by Rule

| Rule | ADR | Count |
|---|---|---|
| Semantic Color at Rest | ADR 0036 §1 | 10 |

## Violation Breakdown by Directory

| Directory | Violations | Status |
|---|---|---|
| `components/StubsWorkspace.tsx` | 10 | ⚠️ Needs Review |

## Detailed Violation Log

- **[ERROR]** `src/components/StubsWorkspace.tsx:49` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  3: { title: "Layer 3: UI Components", color: "border-warning/40 text-warning bg-warning/10" },
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:52` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  6: { title: "Layer 6: Server Infrastructure", color: "border-destructive/40 text-destructive bg-destructive/10" },
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:765` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <span className="text-xs font-bold text-destructive uppercase tracking-tight">
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:772` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  className="p-3 rounded-lg bg-destructive/10 border border-rose-500/30 text-xs flex flex-col gap-1"
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:775` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <span className="font-mono font-bold text-destructive uppercase text-[10px]">
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:845` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  ? "text-destructive"
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:847` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  ? "text-warning"
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:875` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <span className="text-xl font-bold font-mono text-destructive my-1">
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:887` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <span className="text-xl font-bold font-mono text-warning my-1">
  ```
- **[ERROR]** `src/components/StubsWorkspace.tsx:1155` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <span className="text-destructive">{log.text}</span>
  ```
