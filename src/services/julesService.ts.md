---
title: "Google Jules Agent Service Specification"
type: service-spec
status: spec
target_code_file: src/services/julesService.ts
version: 1.0.0
tags:
  - jules
  - agent
  - sessions
  - github
  - proxy
---

# Google Jules Agent Service Specification

## 1. Architectural Responsibility
Provides client-side management, backend API proxying, and session lifecycle orchestration for Google Jules (`jules.google.com`). Enables configuring GitHub repository targets, managing asynchronous coding tasks, streaming agentic execution steps, reviewing plans, inspecting file diffs, and tracking pull requests directly within AI Studio Mobile.

## 2. Design Tree & Frontier Status
- [x] Round 1 - Q1 (Navigation Paradigm): Option A (Dedicated workspace mode `promptType: 'jules'`)
- [x] Round 1 - Q2 (Session Boundary): Option B (Dedicated Jules session area and drawer decoupled from chat prompts)
- [x] Round 1 - Q3 (Chat Surface): Option A (Polymorphic message stream with structured Jules activity cards)
- [x] Round 1 - Q4 (Key Ingestion): Option A (Unified `ApiKeyModal` with Google AI Studio vs. Google Jules tabs + `CustomTabBrowserModal` target)
- [x] Round 1 - Q5 (Backend Gateway): Option A (Dedicated `/api/jules/*` Express routes)
- [x] Round 2 - Q1 (Jules Session & Task Model): Option A (Comprehensive GitHub-Centric Session Model)
- [x] Round 2 - Q2 (Jules Top Bar Toolbar & Context): Option A (Adaptive Contextual Toolbar in `TopAppBar`)
- [x] Round 2 - Q3 (Execution Loop & Human-in-the-Loop): Option C (Configurable Auto-Approve Plans Toggle)
- [x] Round 2 - Q4 (Key Storage & Project Scope): Single User-Account Key (`jules_api_key`)
- [x] Round 2 - Q5 (Backend Proxy Strategy): Live API proxy only; zero simulated/mock layers
- [x] Round 3 - Q1 (Repository Authorization & Discovery UX): Option A (Dynamic Repo Discovery via Jules API + manual fallback)
- [x] Round 3 - Q2 (Task Execution Engine): Option A (Adaptive 2.5s Short-Interval Polling over `/api/jules/tasks/:id`)
- [x] Round 3 - Q3 (Session Management Drawer Architecture): Option A (Slide-over `JulesSessionDrawer`)
- [x] Round 3 - Q4 (Error States & Unauthenticated Fallbacks): Option A (In-Chat Explanatory Hero Card + one-tap credential modal)

## 3. Data Interface Contracts

```typescript
export type JulesTaskStatus = 
  | "idle"
  | "queued"
  | "analyzing"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "review_ready"
  | "completed"
  | "failed";

export interface JulesExecutionStep {
  id: string;
  title: string;
  detail?: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: number;
  diffSummary?: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

export interface JulesPullRequest {
  number: number;
  title: string;
  url: string;
  branch: string;
  state: "open" | "merged" | "closed";
}

export interface JulesRepository {
  id: string;
  fullName: string; // e.g. "google/mesop"
  owner: string;
  name: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
}

export interface JulesActivity {
  type: "plan" | "step" | "diff" | "pull_request" | "error";
  status: JulesTaskStatus;
  plan?: string[];
  currentStep?: JulesExecutionStep;
  steps?: JulesExecutionStep[];
  pullRequest?: JulesPullRequest;
  diff?: string;
  requiresApproval?: boolean;
}

export interface JulesSession {
  id: string;
  title: string;
  repository: string; // e.g. "owner/repo"
  branch: string;     // e.g. "main"
  targetBranch?: string; // e.g. "jules/fix-auth"
  status: JulesTaskStatus;
  plan?: string[];
  steps: JulesExecutionStep[];
  pullRequest?: JulesPullRequest;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface JulesSettings {
  autoApprovePlans: boolean;
  defaultBranch: string;
}
```
