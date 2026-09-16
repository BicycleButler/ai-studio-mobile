---
title: "Application Navigation Consistency & Redundancy Elimination Plan"
type: initiative-plan
description: "Architectural blueprint and grilling decision matrix for eliminating navigation inconsistencies, redundant headers, and ADR violations across Chat, Mobile IDE, Jules, and Stubs workspaces."
tags:
  - planning
  - navigation
  - ux
  - adr-0037
  - adr-0039
  - adr-0043
  - adr-0045
  - adr-0035
phase: grill
status: in_progress
version: 1
status_flag: clean
initiative: navigation-consistency
---

# Application Navigation Consistency & Redundancy Elimination Plan

## Executive Summary
The application currently exhibits significant navigational fragmentation and visual redundancy across its four primary workspaces (`Chat`, `Mobile IDE`, `Jules`, `Stubs`):
1. **Inconsistent Navigation Paradigm**: The 4-slot bottom navigation is rendered as a modal sheet drawer (`BottomNavBar`) opened via disparate triggers (a floating `PanelBottom` button in Chat, a `Workspaces` button on a second header in Jules, a `Menu` hamburger icon in Stubs, and completely inaccessible from Mobile IDE where only a `<- Prompt` back button exists). This violates ADR 0045's core rule requiring a single, consistent mobile bottom action paradigm.
2. **Double Headers & Vertical Waste**: Viewports render stacked headers (`TopAppBar` + secondary workspace headers in Jules, Mobile IDE, and Stubs), consuming between 110px and 160px of vertical space and violating ADR 0037 (Navigation Header Bar) and ADR 0039 (Page Toolbar & Section Header Standards).
3. **Floating Controls vs Standard Toolbars**: Standard chat actions (`New Chat / History`, `Prompt Templates`, `Workspaces`) float directly over message content in an unanchored vertical stack, clashing with ADR 0043 and ADR 0045.
4. **Redundant Project & Model Management**: The expandable "Sparkles" drawer in `TopAppBar` duplicates the `UnifiedSettingsModal` (Account, Workspace Vault, Model settings) and introduces secondary actions in non-standard locations.
5. **ADR Violations (Audit)**: Lingering badges/pills (`PWM` tags), colored status dots, and static resting alert colors in Stubs and drawers violating ADR 0035 and ADR 0020.

## Design Tree Mapping

```
Navigation Consistency & Redundancy Elimination
├── 1. Primary Navigation Paradigm [FRONTIER: Q1]
│   ├── Option A: Persistent Docked Bottom Bar across ALL workspaces (ADR 0045 Sticky Footer)
│   └── Option B: Unified TopAppBar Workspace Tabs / Segmented Switcher + deprecate bottom drawer
├── 2. Header Architecture & Double Header Elimination [SETTLED: Minimalist Single TopAppBar]
│   └── Implemented: Left zone hosts borderless token counter (tapping tunes parameters); Right zone hosts workspace switcher and persistent overflow popover (Profile -> Auth, Theme, Workspaces, Settings).
├── 3. Chat & Jules Session/Action Control Standard [FRONTIER: Q3]
│   ├── Option A: Anchor actions (New, History, Templates) into standard single-row section toolbar (ADR 0039)
│   └── Option B: Move secondary workspace actions into unified TopAppBar right-zone overflow
├── 4. Redundant Drawer & Quick Access Elimination [SETTLED]
│   └── Implemented: Eliminated redundant sparkler drawer and resting filter icon; model/tuner parameters consolidated under token counter button; settings and profile accessible via overflow popover.
└── 5. ADR Compliance Cleanup [SETTLED: 0 audit violations across all 61 files]
    ├── 5.1 ADR 0035: Remove all status pills and badges ('PWM', status dots)
    ├── 5.2 ADR 0020: Convert static resting alert colors to neutral tokens
    └── 5.3 ADR 0022: Replace transition:all with explicit transition properties
```

## Settled Architectural Decisions (Header Refactor)
- **Left Zone Minimalism**: Removed sparkle brand icon and verbose title/subtitle text. Installed `TokenCounterVisualization` on the left zone with `borderless={true}`, satisfying ADR 0037 and ADR 0039. Tapping the token counter triggers model parameters tuning.
- **Redundant Filter Removal**: Removed `top-model-tuner-btn` (`SlidersHorizontal`) because tuning is directly accessible via the token counter button.
- **Theme Selector Relocation**: Removed `header-theme-toggle-btn` from resting header toolbar; relocated into the overflow menu popover as the second item.
- **Overflow Popover Navigation**: The persistent overflow anchor (`MoreVertical`) opens a vertical navigation popover containing:
  1. `Profile` (navigates to Auth tab in UnifiedSettingsModal)
  2. `Theme` (inline theme selector toggling between Light and Dark mode)
  3. `Workspaces` (activates workspace switcher)
  4. `Settings` (opens UnifiedSettingsModal)
  5. `Jules Sessions` (when in Jules mode, opens session repository selector)
- **ADR Audit Status**: 61/61 files compliant (0 errors, 0 warnings).
