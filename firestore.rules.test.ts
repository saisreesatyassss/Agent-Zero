/**
 * AGENT ZERO — Phase 0 Payload-First Security Test Suite (`firestore.rules.test.ts`)
 * Verifies that all 12 "Dirty Dozen" adversarial payloads defined in `security_spec.md`
 * are rejected with PERMISSION_DENIED by `firestore.rules`.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'delete' | 'list' | 'get';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRuleGate: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Project Create',
    collection: 'projects/proj_1',
    operation: 'create',
    auth: { uid: 'uid_attacker', email_verified: true },
    payload: { id: 'proj_1', ownerId: 'uid_victim', budget: 20 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    collection: 'projects/proj_1',
    operation: 'create',
    auth: { uid: 'uid_unverified', email_verified: false },
    payload: { id: 'proj_1', ownerId: 'uid_unverified', budget: 20 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Agent Update',
    collection: 'agents/RSC-001',
    operation: 'update',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { isVerifiedAdmin: true, status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.keys().hasOnly(...) && affectedKeys().hasOnly(...)',
  },
  {
    id: 4,
    name: 'Orphaned Task Creation',
    collection: 'tasks/task_99',
    operation: 'create',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { id: 'task_99', project_id: 'ghost_project', ownerId: 'uid_owner' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'ownsParentProject(incoming().project_id)',
  },
  {
    id: 5,
    name: 'Cross-Tenant Task Injection',
    collection: 'tasks/task_99',
    operation: 'create',
    auth: { uid: 'uid_attacker', email_verified: true },
    payload: { id: 'task_99', project_id: 'proj_victim', ownerId: 'uid_attacker' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'get(/databases/$(database)/documents/projects/$(projectId)).data.ownerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'Negative Ledger Entry',
    collection: 'ledger_entries/le_1',
    operation: 'create',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { id: 'le_1', amount: -50.0, direction: 'credit' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.amount is number && data.amount > 0',
  },
  {
    id: 7,
    name: 'Ledger Mutation Attack',
    collection: 'ledger_entries/le_1',
    operation: 'update',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { amount: 9999.0 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'allow update, delete: if false;',
  },
  {
    id: 8,
    name: 'Subcontract Delegation Depth Overflow',
    collection: 'tasks/sub_3',
    operation: 'create',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { id: 'sub_3', delegation_depth: 5 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.delegation_depth >= 0 && data.delegation_depth <= 2',
  },
  {
    id: 9,
    name: 'Terminal State Reversal on Settled Project',
    collection: 'projects/proj_settled',
    operation: 'update',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { status: 'executing' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "!(existing().status in ['settled', 'cancelled'])",
  },
  {
    id: 10,
    name: 'Resource Poisoning Document ID',
    collection: 'projects/invalid id with spaces!',
    operation: 'create',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { id: 'invalid id with spaces!' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "isValidId(id) && id.matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 11,
    name: 'Value Poisoning on Update',
    collection: 'projects/proj_1',
    operation: 'update',
    auth: { uid: 'uid_owner', email_verified: true },
    payload: { status: 'hacked_status_enum' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isValidProject(incoming()) wrapping allow update',
  },
  {
    id: 12,
    name: 'Unauthorized List Scraping Without Owner Filter',
    collection: 'projects',
    operation: 'list',
    auth: { uid: 'uid_attacker', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'allow list: if isOwner(existing().ownerId);',
  },
];
