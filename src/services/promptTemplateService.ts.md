---
title: Prompt Template Service & Compose Architecture
type: service-spec
status: materialized
target_code_file: src/services/promptTemplateService.ts
version: 1.0.0
tags:
  - prompts
  - templates
  - compose
  - chat
depends_on:
  - src/utils/timeProvider.ts
  - src/types.ts
  - src/utils/storage/index.ts
  - src/utils/storage/types.ts
  - src/utils/idGenerator.ts
  - src/services/firestoreSyncService.ts
status_flag: clean
ast_hash: b92bc32565a5
---

# Prompt Template Service & Selection Architecture Specification

## 1. Architectural Responsibility
Provides management, local persistence, and sequential composition of reusable prompt templates for Google AI Studio Mobile.
Enables:
1. Supplying a curated collection of generic starter prompt templates across coding, reasoning, tone, formatting, and analysis.
2. Permitting users to author, persist, update, and delete custom prompt templates.
3. Managing an ordered selection queue of prompt templates associated with the active draft prompt.
4. Rendering selected templates in a dedicated tray immediately above the input text dock.
5. Concatenating ordered prompt templates ahead of manual user input into a unified prompt payload for the Gemini model.

## 2. Design Tree & Frontier Status
- [x] Frontier Decision 1: Prompt Template Data Model & Seed Persistence -> Option A (Union of immutable starter seeds with editable user templates in local storage)
- [x] Frontier Decision 2: Input Dock Tray & Selection Representation -> Option A (Horizontal compact tray above input with re-orderable / dismissible chips)
- [x] Frontier Decision 3: Template Discovery & Authoring Surface -> Option A (Unified modal/sheet with tabbed filtering, preview, and drafting form)
- [x] Frontier Decision 4: Multi-Template Message Concatenation Protocol -> Option A (Double-newline delimited sequential concatenation: `T1 + \n\n + T2 + \n\n + UserText`)
- [x] Frontier Decision 5: Chat Bubble Display & Provenance Tracking -> Option A (Persist template IDs in message metadata, showing template chips above user query in conversation)

## 3. Data Interface Contract

```typescript
export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  content: string;
  category: "coding" | "reasoning" | "tone" | "formatting" | "analysis" | "custom";
  isBuiltin?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ComposePromptPayload {
  combinedText: string;
  templateIds: string[];
  userText: string;
}
```

## 4. Proposed Generic Starter Templates
1. **Concise & Direct** (`tone`): "Respond concisely and directly without conversational filler or pleasantries. Focus on high-signal, actionable answers."
2. **Staff Code Engineer** (`coding`): "You are an expert Google staff software engineer. Write clean, production-grade, fully-typed TypeScript and modern Kotlin. Prioritize correctness, edge cases, and performance."
3. **Step-by-Step Reasoner** (`reasoning`): "Think through this problem methodically step-by-step. Break down your reasoning before presenting the final conclusion."
4. **Valid JSON Output** (`formatting`): "Format your response strictly as valid, raw JSON conforming to standard syntax. Do not include markdown code ticks, preamble, or trailing commentary."
5. **Security & Edge-Case Auditor** (`analysis`): "Critically analyze the provided solution for security vulnerabilities, edge-case failures, concurrency hazards, and input sanitization gaps."
6. **Simple & Intuitive (ELI5)** (`tone`): "Explain the concept in simple, accessible language using intuitive real-world analogies. Prevent unnecessary technical jargon."
