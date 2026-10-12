---
title: "UI Minimalism & Icon/Tag Hygiene Plan"
type: initiative-plan
description: "Architectural blueprint and grilling decision matrix for eliminating decorative icons, redundant badges/tags (IDE, sys, Live, Autonomous), and non-actionable visual noise across workspace selectors and headers."
tags:
  - planning
  - design-system
  - minimalism
  - adr-compliance
  - ui
phase: complete
status: complete
version: 1
status_flag: clean
initiative: ui-minimalism
---

# UI Minimalism & Icon/Tag Hygiene Plan

## Executive Summary
This initiative streamlines the application UI towards a high-density, distraction-free minimalist aesthetic strictly compliant with `/design` skill guidelines, ADR 0035 (Total Ban on Badges/Pills/Tags), ADR 0043 (Button Text vs Icon Rules), and ADR 0021 (Iconography Standards). It eliminates redundant icons from the workspace mode selector and dropdown, removes deprecated status tags (`IDE`, `sys`, `Live`, `Autonomous`), removes decorative icons from workspace headers, and audits non-interactive icons across the codebase.

## Design Tree Mapping

```
UI Minimalism & Hygiene
├── 1. Workspace Selector (TopAppBar)
│   ├── 1.1 State Trigger Button (Header)
│   │   ├── Mode icon removal (MessageSquare, FileText, etc.)
│   │   └── 'sys' tag removal
│   └── 1.2 Mode Dropdown Menu
│       ├── Option leading icon tiles removal
│       ├── 'IDE' tag removal
│       └── Selection indicator retention (Checkmark)
├── 2. Workspace & Tab Headers
│   ├── 2.1 Freeform Canvas Header (Sparkles removal)
│   ├── 2.2 Structured Prompt Header (Table icon removal)
│   ├── 2.3 Mobile IDE Header (Code2 icon & 'Live' tag removal)
│   └── 2.4 Jules Chat Header (Bot icon & 'Autonomous' tag removal)
├── 3. System-Wide Icon Audit (Meaningful vs Decorative)
│   ├── 3.1 Non-Interactive Section/Label Decorative Icons
│   │   ├── Model output header Sparkles
│   │   ├── Variables section header Variable icon
│   │   └── Expanded drawer section icons (Cpu, Key, FolderGit2)
│   ├── 3.2 Mobile Bottom Navigation Bar (BottomNavBar)
│   │   ├── Keep Icon + Label (standard mobile nav convention) vs Text-only
│   │   └── ADR 0045 & ADR 0021 alignment
│   ├── 3.3 IDE File Switcher Tabs
│   │   ├── Keep file type icons (Smartphone, FileCode2, etc.) vs Text-only (.kt, .ts, .py)
│   ├── 3.4 Meaningful / Semantic Icons (Preserved)
│   │   └── Critical alerts & warnings (AlertTriangle, Shield, WifiOff)
│   └── 3.5 Interactive Action Icons (Preserved)
│       └── Tap/click actions (Send, Mic, Copy, X, Trash2, Sliders, Menu, Chevron)
└── 4. ADR 0035 Deprecation Enforcement
    ├── 'Gemini Client' pill in expanded drawer
    └── 'Active' pill in system instructions drawer
```

## Round 1 Grill Frontier
See active grilling round below.
