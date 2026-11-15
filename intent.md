# Product Intent & Vision: AI Studio Mobile

## End-State Vision
**AI Studio Mobile** is a responsive, mobile-first Google AI Studio prompt engineering environment and playground built with React 19, TypeScript, Vite, Tailwind CSS, and the `@google/genai` SDK.

The primary goal is to empower developers and prompt designers to experiment with Gemini models (Gemini 2.5 Flash, Gemini Pro, Thinking models, Vision, and Audio) with real-time streaming, prompt templates, structured output, and multi-language code export—from anywhere, on any device.

## Core Target Workflows
1. **Multimodal Experimentation:** Seamlessly chat and iterate with text, voice (speech-to-text), and images.
2. **Autonomous Agent Execution:** Leverage Google Jules workflows to securely authorize GitHub repositories, submit PRs, and review architectural plans on the go.
3. **Architecture-as-Code Auditing:** Inspect and grill repository dependencies and stubs through the Stubs portal.
4. **Offline & Sync Resilience:** Draft prompts, review architecture offline, and seamlessly recover state.
5. **Batch Productivity:** Rapidly curate, batch-select, and bulk-manage sessions, workspaces, and prompts without tedious single-item interactions (for example, ADR 0047 implementation).

## Architectural Imperatives
- Strict adherence to the `knowledge/design/` ADR corpus (zero semantic colors at rest, strict typography scale, mobile-safe footers).
- No floating status badges (ADR 0035 compliance).
- Subsystem encapsulation through defined Context Maps.

*This document serves as the true north for all subagent planning, routing, and task materialization.*
