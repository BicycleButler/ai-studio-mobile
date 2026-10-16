Batch 2 Proposal

Type: Abstraction
Risk: Medium
File: `src/App.tsx`, `src/components/WorkspaceRouter.tsx`
Change: Extract the inline workspace rendering (the `if (promptType === ...)` block) from `App.tsx` into a dedicated `WorkspaceRouter` component. `App.tsx` is currently passing many props to these workspaces directly. By extracting this component, we can encapsulate the switching logic and possibly group the props better, which drastically reduces the length and complexity of `App.tsx`.
Justification: Fulfills the goal to "Prioritize abstraction (deeper classes, better interfaces, reduced coupling)". `App.tsx` has too many responsibilities. Extracting routing creates a cleaner interface.
