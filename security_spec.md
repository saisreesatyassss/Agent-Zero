# AGENT ZERO — Phase 0: Payload-First Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth

1. **Identity & Verified Ownership Invariant**: Every write operation across all collections (`/agents`, `/projects`, `/tasks`, `/bids`, `/contracts`, `/deliverables`, `/ledger_entries`, `/payments`, `/agent_messages`) requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`) and enforces that `incoming().ownerId == request.auth.uid`.
2. **Relational Parent Invariant**:
   - A `Task`, `Bid`, `Contract`, `Deliverable`, `LedgerEntry`, `Payment`, or `AgentMessage` cannot be created unless its referenced `project_id` exists in `/projects/$(incoming().project_id)` AND belongs to the authenticated user (`get(/databases/$(database)/documents/projects/$(incoming().project_id)).data.ownerId == request.auth.uid`).
3. **Economic Budget & Positive Amount Invariant**:
   - `Project.budget > 0 && Project.budget <= 10000`
   - `Task.allocated_budget >= 0 && Task.delegation_depth >= 0 && Task.delegation_depth <= 2`
   - `LedgerEntry.amount > 0` and `LedgerEntry` documents are strictly append-only (no updates or deletes permitted).
4. **Immutability & Terminal State Locking**:
   - `ownerId`, `createdAt`, and `project_id` are immortal fields that cannot be mutated during `update`.
   - Once a `Project` reaches `"settled"` or `"cancelled"`, or a `Contract` reaches `"settled"` or `"cancelled"`, no subsequent client updates are allowed unless performed by the verified bootstrapped admin.
5. **Query Enforcer Invariant**:
   - No blanket `allow list: if isSignedIn();` rules exist. Every `list` operation enforces `resource.data.ownerId == request.auth.uid`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Project Create)**: Authenticated user `uid_attacker` creates `/projects/proj_1` with `ownerId: "uid_victim"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Unverified Email Write)**: User with `email_verified: false` attempts to create `/projects/proj_1`. -> `PERMISSION_DENIED`
3. **Payload 3 (Shadow Field Injection on Agent Update)**: User sends `isVerifiedAdmin: true` ghost key when updating `/agents/RSC-001`. -> `PERMISSION_DENIED`
4. **Payload 4 (Orphaned Task Creation)**: User creates `/tasks/task_99` referencing non-existent `/projects/ghost_project`. -> `PERMISSION_DENIED`
5. **Payload 5 (Cross-Tenant Task Injection)**: User `uid_attacker` creates `/tasks/task_99` referencing `/projects/proj_victim` owned by `uid_victim`. -> `PERMISSION_DENIED`
6. **Payload 6 (Negative Ledger Entry)**: User creates `/ledger_entries/le_1` with `amount: -50.00`. -> `PERMISSION_DENIED`
7. **Payload 7 (Ledger Mutation Attack)**: User attempts `update` on existing `/ledger_entries/le_1` to alter `amount`. -> `PERMISSION_DENIED`
8. **Payload 8 (Subcontract Delegation Depth Overflow)**: User creates `/tasks/sub_3` with `delegation_depth: 5` (exceeding max depth of 2). -> `PERMISSION_DENIED`
9. **Payload 9 (Terminal State Reversal)**: User attempts to update `/projects/proj_settled` after `status == "settled"`. -> `PERMISSION_DENIED`
10. **Payload 10 (Resource Poisoning ID)**: User attempts to create a document with an invalid path variable containing spaces/special chars or >128 chars. -> `PERMISSION_DENIED`
11. **Payload 11 (Value Poisoning on Update)**: User updates whitelisted field `status` on `/projects/proj_1` with an integer `999` or invalid enum value `"hacked"`. -> `PERMISSION_DENIED`
12. **Payload 12 (Unauthorized List Scraping)**: User executes an unfiltered `list` query on `/projects` without `where("ownerId", "==", request.auth.uid)`. -> `PERMISSION_DENIED`

---

## 3. Red Team Audit & Conflict Resolution Report

- **Identity Spoofing**: Blocked on every `create` via `data.ownerId == request.auth.uid` and on every `update` via `incoming().ownerId == existing().ownerId`.
- **State Shortcutting & Terminal Locking**: Blocked on `projects` (`!(existing().status in ['settled', 'cancelled'])`) and `contracts` (`!(existing().status in ['settled', 'cancelled'])`), and `ledger_entries` / `agent_messages` are strictly immutable (`allow update, delete: if false;`).
- **Resource Poisoning**: Every string field has an explicit `.size() <= MAX` bound matching `firebase-blueprint.json`, every array field has `.size() <= 50`, and all document IDs are guarded by `isValidId()`.
- **Value Poisoning**: Every `allow update` block begins with `isValid[Entity](incoming())` in addition to `affectedKeys().hasOnly(...)`.
