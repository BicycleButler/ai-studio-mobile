# Firestore Security Specification (`security_spec.md`)

## Phase 0: Data Invariants

1. **Identity & Ownership**:
   - Every `/users/{userId}` document must have `uid == request.auth.uid == userId` and non-PII fields only.
   - Every subcollection document under `/users/{userId}/(prompts|chatSessions|templates|projects)/{docId}` must belong to an existing `/users/{userId}` parent document (`exists(...)` Master Gate) and enforce `ownerId == request.auth.uid == userId`.
   - All writes require `request.auth != null && request.auth.token.email_verified == true`.
2. **PII Isolation**:
   - User `email` is strictly isolated in `/users/{userId}/private/{infoId}` and readable/writable only by the verified owner (`isOwner(userId)`).
3. **No Secrets in Cloud**:
   - `WorkspaceProjectDoc` strictly forbids secret keys (`apiKey`, `token`, `serviceAccountJson`) via `keys().hasOnly(...)`.
4. **Temporal & Structural Integrity**:
   - `createdAt == request.time` on `create`; `createdAt == existing().createdAt` and `updatedAt == request.time` on `update`.
   - Every document ID path variable passes `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
   - Every string field enforces strict `.size()` bounds; every array enforces `.size() <= MAX` and validates element types.

---

## The "Dirty Dozen" Attack Payloads (Must All Yield `PERMISSION_DENIED`)

1. **Unauthenticated Read/Write**: Read `/users/alice/prompts/p1` with `auth = null`.
2. **Unverified Email Write**: Create `/users/alice` with `auth = { uid: 'alice', token: { email_verified: false } }`.
3. **Cross-Tenant Ownership Spoof**: User `bob` writes `/users/alice/prompts/p1` with `{ ownerId: 'alice', ... }`.
4. **OwnerId Hijack in Subcollection**: User `bob` writes `/users/bob/prompts/p1` with `{ ownerId: 'alice', ... }`.
5. **Shadow Field Injection ("Ghost Field")**: User `alice` creates `/users/alice/projects/proj_1` with `{ id: 'proj_1', ownerId: 'alice', name: 'Test', defaultModel: 'gemini-3-flash', apiKey: 'AIzaSySecret', isAdmin: true, ... }`.
6. **Orphaned Subcollection Write**: User `alice` creates `/users/alice/chatSessions/s1` when `/users/alice` parent doc does not exist.
7. **PII Blanket Probe**: User `bob` attempts `get` or `list` on `/users/alice/private/info`.
8. **ID Poisoning**: User `alice` writes `/users/alice/prompts/invalid$id!with/slash_or_long_150_chars`.
9. **Resource Exhaustion (1MB String)**: User `alice` creates `/users/alice/templates/t1` with `title` > 160 chars or `content` > 20,000 chars.
10. **Array Element Type Poisoning**: User `alice` creates `/users/alice/chatSessions/s1` with `messages: [12345]` (non-map entry).
11. **Temporal / Immutable Field Tampering**: User `alice` updates `/users/alice/prompts/p1` trying to alter `createdAt`, `ownerId`, or `id`, or set `updatedAt` to a client timestamp instead of `request.time`.
12. **Unscoped Collection Query Scraping**: User `bob` attempts `list` on `/users/alice/prompts` without matching `resource.data.ownerId == request.auth.uid`.
