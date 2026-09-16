---
title: "Hands-Free Voice Mode Button UI & Touch Optimization Plan"
type: initiative-plan
description: "Architectural specification for adaptive split-dock (50/50 resting split ↔ full-width expansions), stripping redundant buffers, and maximizing touch ergonomics."
tags:
  - planning
  - design-system
  - voice-mode
  - touch-ergonomics
  - adr-compliance
phase: materialization
status: in_progress
version: 2
status_flag: clean
initiative: hands-free-voice-button
---

# Hands-Free Voice Mode Button UI & Touch Optimization Plan

## Executive Summary
Following collaborative grilling rounds with the user, we have finalized the adaptive split-dock architecture:
1. **Resting State (50/50 Split)**:
   - The bottom dock features an 80px (`h-20`) touch canvas divided equally.
   - **Left 50%**: Text input card showing clean placeholder text ("Type message..."), with **zero buttons** in resting state to avoid visual clutter. Tapping anywhere on the left card expands it to 100% full width and focuses the input.
   - **Right 50%**: Hands-Free Voice button. Clean icon-only button with prominent `Mic` (Microphone) icon, retaining the signature primary gradient colors extending across the entire right half, with a 100% tactile hit target and zero nested cards or cluttered text.
2. **Text Input Expansion & Accordion Split**:
   - Tapping/focusing the text card animates it to 100% horizontal width, revealing the accessory buttons (`ImageIcon`, `Send`, height expander).
   - If the user blurs with no text entered, it auto-collapses back to the 50/50 split.
   - If text is drafted, it remains expanded.
3. **Voice Mode Active State (100% Full-Width Hub)**:
   - Tapping the Hands-Free Voice button expands it to 100% full width (`w-full h-20`).
   - Features dynamic real-time waveforms for listening/speaking/thinking, real-time status copy, and a dedicated **Interrupt** button when speaking.
   - **Full-Surface Exit Interaction**: The entire expanded section is tappable to immediately exit hands-free mode, eliminating tiny corner buttons in favor of effortless whole-bar touch targeting.
   - Tapping anywhere on the expanded hub cleanly collapses the dock back to the 50/50 resting split.
4. **ADR Alignment**:
   - Complies with ADR 0029 (Button Hierarchy & State transitions).
   - Complies with ADR 0035 (Total ban on arbitrary pill tags/badges like "Free & Instant").
   - Complies with ADR 0045 (Mobile Sticky Footer & Touch Targets ≥ 44–48px; resting buttons are 80px tall).


---

## Design Tree Mapping

```
Hands-Free Voice Mode Button Optimization
├── 1. Placement & Dock Integration (Below Chat Input Bar)
│   ├── 1.1 Unified Dock Surface (Single container enclosing input bar + voice button directly below it)
│   └── 1.2 Distinct Sub-Container (Separate container below the input dock with its own border-t)
├── 2. Touch Area & Buffer Elimination (Ergonomics)
│   ├── 2.1 Max-Touch Action Strip (Full-width 48–52px tactile target, tight 6–8px vertical spacing from input row, zero wasted outer padding)
│   └── 2.2 Segmented / Floating Pill (Contained pill with outer margin buffers)
├── 3. Button Content & Visual Hierarchy (Resting State)
│   ├── 3.1 Pure Action Layout (Prominent Mic/Headphones icon + bold "Hands-Free Voice Mode" label, zero nested sub-buttons or pills)
│   └── 3.2 Dual-Action Split (Mic action + settings trigger)
└── 4. Active Conversational State (HUD Behavior)
    ├── 4.1 In-Place HUD Bar (Seamlessly morphs into active listening/speaking visualizer with prominent Interrupt & End controls)
    └── 4.2 Floating Overlay HUD
```

---

## Round 1 Grill Frontier

### Q1 - Dock Integration: Unified Dock Surface vs. Separate Sub-Footer
- **Context**: The input dock currently has `p-2.5 bg-card border-t border-border`. Placing the voice button below the input bar could be done by placing both elements inside the *same* unified bottom dock container (sharing safe-area insets and single border-t), or as a separate stacked container below it.
- **Option A (Unified Dock)**: Combine the prompt input bar and the hands-free voice button inside a single footer dock. The voice button sits directly below the textarea input box with a clean, tight 6–8px vertical gap and no intermediate divider or redundant container padding.
- **Option B (Separate Sub-Footer)**: Keep the input dock and voice button in separate containers, each with its own background and top border.
- ➡️ **Recommendation**: **Option A (Unified Dock)**. Eliminates duplicate borders, prevents redundant container padding from eating vertical viewport space, and ensures safe-area inset calculations apply smoothly to the entire footer assembly.

### Q2 - Touch Target & Buffer Elimination: Full-Width Tactile Strip vs. Inset Pill
- **Context**: The user emphasized: *"The Hands-Free voice mode button has too much buffer and spacing for what it it should do. This needs to be an easy to interact with and large button so any additional padding only reduces the effectiveness of its intended purpose"*.
- **Option A (Full-Width Tactile Action Bar)**: The button spans 100% of the dock's usable width with a solid 48px height (`h-12` / min 48px touch target). The clickable hit target matches the exact visual boundary with zero dead margin/padding space.
- **Option B (Compact Inset Pill)**: Keep a pill or rounded container with horizontal inset margins and smaller height (40px).
- ➡️ **Recommendation**: **Option A (Full-Width Tactile Action Bar)**. Directly fulfills the requirement for an easy-to-interact-with, large tactile button where 100% of the footprint is responsive to touch.

### Q3 - Content & Typography: Streamlined High-Contrast Action vs. Descriptive Labels
- **Context**: Currently, the button contains an outer icon, title ("Hands-Free Voice Mode"), a "Free & Instant" pill badge (ADR 0035 violation), a subtitle description ("Speak naturally · Auto-sends on pauses..."), and an inner nested button ("Start Voice").
- **Option A (Streamlined Action CTA)**: Strip the banned "Free & Instant" badge, subtitle microcopy, and nested faux-button. Render a clean, high-contrast, thumb-friendly button with a crisp Mic/Headphones icon and clear label: **"Start Hands-Free Voice"** (or **"Hands-Free Voice Mode"**), with a subtle pulse/accent indicator.
- **Option B (Retain Subtitle Microcopy)**: Keep the explanatory subtitle below the label inside the button.
- ➡️ **Recommendation**: **Option A (Streamlined Action CTA)**. Eliminates clutter, increases font legibility, complies with ADR 0035/0043, and makes the button feel like an authoritative, instant-action trigger.

### Q4 - Active Voice HUD: In-Place Dock Morph vs. Popout
- **Context**: When voice mode is toggled on (`isVoiceModeActive = true`), the UI transitions to an active state (listening, thinking, speaking, or idle).
- **Option A (In-Place Tactile HUD)**: The button smoothly transitions in-place below the input bar into the active voice controller, displaying the live audio waveform/pulse indicator, active status ("Listening...", "Assistant speaking..."), an immediate **Interrupt** button when speaking, and a clear **End Voice** button.
- **Option B (Float into Message Stream)**: Float the active voice controller over the messages area.
- ➡️ **Recommendation**: **Option A (In-Place Tactile HUD)**. Keeps the interaction anchor rock-solid at the bottom of the screen so user fingers do not have to hunt for the Interrupt or End controls.
