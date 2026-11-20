# Design System Compliance Audit Report

**Date:** 2026-11-20T17:03:28.484Z
**Target Directory:** `src`
**Total Files Audited:** 295
**Clean Files:** 294 (99.7%)
**Files with Violations:** 1
**Total Violations Detected:** 1

## Violation Breakdown by Rule

| Rule | ADR | Count |
|---|---|---|
| Semantic Color at Rest | ADR 0036 §1 | 1 |

## Violation Breakdown by Directory

| Directory | Violations | Status |
|---|---|---|
| `components/ChatMessageItem.tsx` | 1 | ⚠️ Needs Review |

## Detailed Violation Log

- **[ERROR]** `src/components/ChatMessageItem.tsx:149` — **Semantic Color at Rest** (ADR 0036 §1): Semantic alert color (destructive/success/warning) on a resting surface. Only allowed in toasts, open AlertDialogs, blur-triggered form validation, or hover inside open overflow menus.
  ```tsx
  <div className="mt-2 p-2 rounded-lg bg-muted/40 border border-destructive/30 text-destructive text-xs">
  ```
