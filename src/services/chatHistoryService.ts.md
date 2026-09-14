---
title: Chat History & Session Service
type: service-spec
status: materialized
target_code_file: src/services/chatHistoryService.ts
version: 1.0.0
tags:
  - chat
  - history
  - sessions
  - workspaces
---

# Chat History & Session Service Specification

## 1. Architectural Responsibility
Provides session-level lifecycle management and local persistence for multi-turn chats in Google AI Studio Mobile. Enables starting fresh conversation sessions, archiving completed/in-progress chats, retrieving chronological chat history, switching active sessions, and deleting past chats.

## 2. Design Tree & Frontier Status
- [x] Frontier Decision 1: Plus Button Trigger Paradigm -> Option A (Anchored Popover Menu with "+ New Chat" and historical conversation list)
- [x] Frontier Decision 2: Session Persistence & Auto-Archiving Strategy -> Option A (Continuous debounced persistence of active session messages)
- [x] Frontier Decision 3: Storage Isolation -> Option A (Project-scoped storage isolation with fallback to default)
- [x] Frontier Decision 4: History Management Capabilities -> Option A (Active switch, relative timestamps, and deletion)
- [x] Frontier Decision 5: Window Top-Right Placement -> Option A (Floating transparent borderless '+' overlay in ChatWorkspace)

## 3. Data Interface Contract

```typescript
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  projectId?: string;
}
```

## 4. UI Trigger Contract
- Trigger button: Located strictly in the top right of the chat window (`ChatWorkspace`), completely separated from the page header (`TopAppBar`).
- Icon: Visual Lucide `Plus` icon sized smaller than standard icons (14px / `w-3.5 h-3.5`).
- Container: Borderless, transparent background (`bg-transparent border-0`), maintaining a full 44×44px interactive tap target (`min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center`).
