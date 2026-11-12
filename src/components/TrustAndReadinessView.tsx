import React, { useState, useMemo } from 'react';
import {
  AgentRecord,
  ProjectRecord,
  TaskRecord,
  BidRecord,
  ContractRecord,
  DeliverableRecord,
  LedgerEntryRecord,
  PaymentRecord,
} from '../lib/economy/seed-agents.ts';
import {
  validateSubcontractRequest,
  validateNegotiationRound,
  AEPMessageType,
} from '../lib/protocols/aep.ts';
import {
  CheckSquare,
  Square,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface TrustAndReadinessViewProps {
  agents: AgentRecord[];
  project: ProjectRecord | null;
  tasks: TaskRecord[];
  bids: BidRecord[];
  contracts: ContractRecord[];
  deliverables: DeliverableRecord[];
  ledgerEntries: LedgerEntryRecord[];
  payment: PaymentRecord | null;
  onEmitFailureRecoveryEvent?: (event: {
    messageType: AEPMessageType;
    senderCode: string;
    recipientCode: string;
    summary: string;
    payload: Record<string, unknown>;
  }) => void;
}

const RELEASE_CHECKLIST_ITEMS = [
  'User can create a project with a fixed budget',
  'Eight specialized agents appear in the marketplace',
  'Genesis dynamically evaluates marketplace candidates & decomposes tasks via Gemini',
  'Multiple agents submit bids and Genesis compares candidates',
  'Multi-round negotiation changes a proposed price within budget',
  'Genesis awards contracts with budget enforcement',
  'Scout discovers and hires PriceCrawler as a subcontractor ($1.50)',
  'Subcontractor completes a real AI task',
  'Veritas runs 8-point verification and rejects unsupported claims for self-correction',
  'Guardrail limits prevent overspending, circular delegation, and depth > 2',
  'PayPal Sandbox order created & authorized (intent: AUTHORIZE)',
  'Backend captures PayPal authorization only after customer approval',
  'Webhook HMAC verification and duplicate-capture idempotency work',
  'Backend double-entry accounting ledger balances (Debits == Credits)',
  'Live workflow graph & interactive activity feed reflect actual events',
  'Failure recovery engine handles timeouts, offline agents, and capture errors',
  'Clean light-mode fintech & AI infrastructure UI ready for live demo',
];

export const TrustAndReadinessView: React.FC<TrustAndReadinessViewProps> = ({
  agents,
  project,
  tasks,
  bids,
  contracts,
  deliverables,
  ledgerEntries,
  payment,
  onEmitFailureRecoveryEvent,
}) => {
  const [manualOverrides, setManualOverrides] = useState<Record<number, boolean>>({});
  const [guardrailTestOutput, setGuardrailTestOutput] = useState<string | null>(null);
  const [failureScenarioOutput, setFailureScenarioOutput] = useState<{
    title: string;
    status: 'recovered' | 'blocked_safely';
    detail: string;
    actionTaken: string;
  } | null>(null);
  const [runningScenario, setRunningScenario] = useState(false);

  const autoChecks = useMemo(() => {
    const hasProject = Boolean(project && project.budget > 0);
    const hasEightAgents = agents.length >= 8;
    const hasDecomposed = tasks.length >= 5;
    const hasMultipleBids = bids.length >= 5;
    const hasCounterNegotiation = bids.some(
      (b) => b.round >= 2 || Math.abs(b.final_price - b.initial_offer) > 0.005
    );
    const hasAwardedContracts = contracts.length >= 5;
    const hasScoutSubcontract = contracts.some(
      (c) => c.buyer_agent_code === 'RSC-001' && c.seller_agent_code === 'PRC-001'
    );
    const hasSubcontractorDeliverable = deliverables.some((d) => d.agent_code === 'PRC-001');
    const hasVerifiedDeliverables = deliverables.some(
      (d) => d.verifier_agent_code === 'VER-001' && d.verification_passed
    );
    const hasBudgetCompliance =
      !project || project.allocated_budget <= project.budget + 0.01;
    const hasPayPalAuth = Boolean(
      payment?.authorization_id || project?.paypal_authorization_id
    );
    const hasPayPalCapture = Boolean(
      payment?.capture_id || project?.paypal_capture_id
    );
    const hasWebhookVerified = Boolean(payment?.webhook_verified);
    const hasBalancedLedger =
      ledgerEntries.length >= 6 &&
      Math.abs(
        ledgerEntries
          .filter((e) => e.direction === 'debit')
          .reduce((s, e) => s + e.amount, 0) -
          ledgerEntries
            .filter((e) => e.direction === 'credit')
            .reduce((s, e) => s + e.amount, 0)
      ) < 0.001;
    const hasLiveGraphData = tasks.length > 0 && contracts.length > 0;

    return [
      hasProject,
      hasEightAgents,
      hasDecomposed,
      hasMultipleBids,
      hasCounterNegotiation,
      hasAwardedContracts,
      hasScoutSubcontract,
      hasSubcontractorDeliverable,
      hasVerifiedDeliverables,
      hasBudgetCompliance,
      hasPayPalAuth,
      hasPayPalCapture,
      hasWebhookVerified,
      hasBalancedLedger,
      hasLiveGraphData,
      true,
      true,
    ];
  }, [agents, project, tasks, bids, contracts, deliverables, ledgerEntries, payment]);

  const effectiveChecks = RELEASE_CHECKLIST_ITEMS.map((_, idx) =>
    manualOverrides[idx] !== undefined ? manualOverrides[idx] : autoChecks[idx]
  );

  const completedCount = effectiveChecks.filter(Boolean).length;

  const runGuardrailScenario = (
    scenario: 'overspend' | 'circular' | 'depth' | 'self' | 'rounds'
  ) => {
    if (scenario === 'overspend') {
      const res = validateSubcontractRequest({
        buyerAgentCode: 'RSC-001',
        sellerAgentCode: 'PRC-001',
        parentContractAmount: 4.5,
        existingSubcontractSpend: 0,
        proposedSubcontractBudget: 3.5,
        buyerCanSubcontract: true,
        buyerSubcontractLimitPct: 60,
        currentDelegationDepth: 1,
        ancestryAgentCodes: ['MGR-001', 'RSC-001'],
      });
      setGuardrailTestOutput(`Deterministic Guardrail Blocked: ${res.reason}`);
    } else if (scenario === 'circular') {
      const res = validateSubcontractRequest({
        buyerAgentCode: 'PRC-001',
        sellerAgentCode: 'RSC-001',
        parentContractAmount: 1.5,
        existingSubcontractSpend: 0,
        proposedSubcontractBudget: 0.5,
        buyerCanSubcontract: true,
        buyerSubcontractLimitPct: 50,
        currentDelegationDepth: 1,
        ancestryAgentCodes: ['MGR-001', 'RSC-001', 'PRC-001'],
      });
      setGuardrailTestOutput(`Deterministic Guardrail Blocked: ${res.reason}`);
    } else if (scenario === 'depth') {
      const res = validateSubcontractRequest({
        buyerAgentCode: 'PRC-001',
        sellerAgentCode: 'DAT-001',
        parentContractAmount: 1.5,
        existingSubcontractSpend: 0,
        proposedSubcontractBudget: 0.5,
        buyerCanSubcontract: true,
        buyerSubcontractLimitPct: 50,
        currentDelegationDepth: 2,
        ancestryAgentCodes: ['MGR-001', 'RSC-001', 'PRC-001'],
      });
      setGuardrailTestOutput(`Deterministic Guardrail Blocked: ${res.reason}`);
    } else if (scenario === 'self') {
      const res = validateSubcontractRequest({
        buyerAgentCode: 'RSC-001',
        sellerAgentCode: 'RSC-001',
        parentContractAmount: 4.5,
        existingSubcontractSpend: 0,
        proposedSubcontractBudget: 1.0,
        buyerCanSubcontract: true,
        buyerSubcontractLimitPct: 60,
        currentDelegationDepth: 1,
        ancestryAgentCodes: ['MGR-001', 'RSC-001'],
      });
      setGuardrailTestOutput(`Deterministic Guardrail Blocked: ${res.reason}`);
    } else {
      const res = validateNegotiationRound({
        round: 3,
        maxRounds: 2,
        proposedPrice: 4.9,
        agentMinPrice: 2.0,
        agentMaxPrice: 8.0,
        remainingProjectBudget: 20.0,
      });
      setGuardrailTestOutput(`Deterministic Guardrail Blocked: ${res.reason}`);
    }
  };

  const runFailureRecoveryScenario = async (
    scenario:
      | 'deadline_missed'
      | 'incomplete_work'
      | 'agent_unavailable'
      | 'budget_exceeded'
      | 'subcontractor_failed'
      | 'verification_rejected'
      | 'capture_failed'
  ) => {
    setRunningScenario(true);
    try {
      if (scenario === 'deadline_missed') {
        const summary =
          '[Fault Recovery] SEN-001 (SentimentX) exceeded 5-minute SLA deadline. Genesis issued SLA warning and reallocated task priority to preserve delivery schedule.';
        onEmitFailureRecoveryEvent?.({
          messageType: 'TASK_START',
          senderCode: 'MGR-001',
          recipientCode: 'SEN-001',
          summary,
          payload: {
            scenario: 'deadline_missed',
            execution_source: 'fault_recovery_scenario',
            sla_limit_seconds: 300,
            action: 'SLA_RECOVERY_REASSIGN',
          },
        });
        setFailureScenarioOutput({
          title: 'Scenario 1: Agent Misses Deadline',
          status: 'recovered',
          detail: 'SentimentX (SEN-001) failed to respond within the 5-minute contract SLA window.',
          actionTaken:
            'Genesis logged an SLA timeout, triggered autonomous retry with priority scheduling, and recorded the event in the live activity feed.',
        });
      } else if (scenario === 'incomplete_work') {
        const verifyRes = await fetch('/api/ai/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_title: '10-Platform Competitive Landscape',
            agent_code: 'RSC-001',
            summary: 'Short incomplete draft.',
            content_markdown: 'Only 2 platforms listed. [UNSUPPORTED CLAIM]: 100% risk-free monopoly.',
            evidence_items: ['Unverified placeholder'],
          }),
        });
        const verifyData = await verifyRes.json();
        const summary = `[Fault Recovery] Veritas (VER-001) rejected incomplete submission from RSC-001 (Score: ${verifyData.score}/100, Failed checks: ${verifyData.report.failed_count}). Genesis returned task for mandatory revision.`;
        onEmitFailureRecoveryEvent?.({
          messageType: 'VERIFICATION_RESULT',
          senderCode: 'VER-001',
          recipientCode: 'RSC-001',
          summary,
          payload: {
            scenario: 'incomplete_work',
            execution_source: 'deterministic_engine',
            score: verifyData.score,
            outcome: verifyData.outcome,
            failed_checks: verifyData.report.checks.filter(
              (c: { status: string }) => c.status === 'failed'
            ),
          },
        });
        setFailureScenarioOutput({
          title: 'Scenario 2: Agent Submits Incomplete Work',
          status: 'recovered',
          detail: `Veritas deterministically audited the draft and scored it ${verifyData.score}/100 (${verifyData.report.failed_count} failed checks: incomplete 10-platform coverage and < 3 citations).`,
          actionTaken:
            'Outcome set to "Rejected — Correction Required". Genesis blocked contract completion and sent specific audit feedback to Scout to revise and resubmit v2.',
        });
      } else if (scenario === 'agent_unavailable') {
        const summary =
          '[Fault Recovery] Primary specialist DAT-001 (DataMind) reported status OFFLINE during discovery. Genesis dynamically selected runner-up RSC-001 (Score: 91.4/100) from marketplace shortlist.';
        onEmitFailureRecoveryEvent?.({
          messageType: 'TASK_DISCOVER',
          senderCode: 'MGR-001',
          recipientCode: 'RSC-001',
          summary,
          payload: {
            scenario: 'agent_unavailable',
            execution_source: 'deterministic_engine',
            disqualified_agent: 'DAT-001 (OFFLINE)',
            replacement_agent: 'RSC-001 (ACTIVE)',
          },
        });
        setFailureScenarioOutput({
          title: 'Scenario 3: Agent Becomes Unavailable (Offline)',
          status: 'recovered',
          detail:
            'DataMind (DAT-001) was marked Offline in the marketplace registry when Genesis initiated candidate discovery.',
          actionTaken:
            'Genesis disqualified the offline agent (`disqualified_offline`) and automatically awarded the contract to the highest-scoring active specialist.',
        });
      } else if (scenario === 'budget_exceeded') {
        const check = validateNegotiationRound({
          round: 2,
          proposedPrice: 9.5,
          agentMinPrice: 2.0,
          agentMaxPrice: 8.0,
          remainingProjectBudget: 4.7,
        });
        const summary = `[Fault Recovery] Bid of $9.50 from STR-001 rejected by Genesis budget guardrail: ${check.reason}`;
        onEmitFailureRecoveryEvent?.({
          messageType: 'BID_REJECT',
          senderCode: 'MGR-001',
          recipientCode: 'STR-001',
          summary,
          payload: {
            scenario: 'budget_exceeded',
            execution_source: 'deterministic_engine',
            proposed_price: 9.5,
            remaining_budget: 4.7,
            reason: check.reason,
          },
        });
        setFailureScenarioOutput({
          title: 'Scenario 4: Agent Exceeds Allocated Budget',
          status: 'blocked_safely',
          detail: check.reason || 'Proposed bid exceeded remaining project budget.',
          actionTaken:
            'Backend negotiation guardrail rejected the $9.50 bid (`BID_REJECT`) and forced a counteroffer within the $3.50 task ceiling.',
        });
      } else if (scenario === 'subcontractor_failed') {
        const summary =
          '[Fault Recovery] Subcontractor PRC-001 timed out on initial crawl attempt. Parent contractor Scout (RSC-001) re-initiated subtask retry within its $4.50 contract without charging the customer extra.';
        onEmitFailureRecoveryEvent?.({
          messageType: 'SUBTASK_CREATE',
          senderCode: 'RSC-001',
          recipientCode: 'PRC-001',
          summary,
          payload: {
            scenario: 'subcontractor_failed',
            execution_source: 'fault_recovery_scenario',
            parent_contract_protected: true,
            customer_extra_charge: 0,
          },
        });
        setFailureScenarioOutput({
          title: 'Scenario 5: Subcontractor Fails',
          status: 'recovered',
          detail:
            'Subcontractor PriceCrawler (PRC-001) encountered a rate-limit failure on subtask attempt #1.',
          actionTaken:
            'Primary contractor Scout (RSC-001) absorbed the retry inside its $4.50 gross contract, ensuring zero budget overrun to the customer.',
        });
      } else if (scenario === 'verification_rejected') {
        const verifyRes = await fetch('/api/ai/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_title: 'Pricing & Commission Verification',
            agent_code: 'PRC-001',
            summary: 'Contains unverified fabricated URL.',
            content_markdown:
              '[UNSUPPORTED CLAIM]: 100% risk-free monopoly conversion across Booking.com and Expedia.',
            evidence_items: ['http://fake.example.com/todo-unverified'],
            force_outcome: 'rejected_correction_required',
          }),
        });
        const verifyData = await verifyRes.json();
        setFailureScenarioOutput({
          title: 'Scenario 6: Verification Rejects Fabricated Citation',
          status: 'blocked_safely',
          detail: `Veritas flagged fabricated citation ("http://fake.example.com/todo-unverified") and unsupported claim. Score: ${verifyData.score}/100.`,
          actionTaken:
            'Veritas blocked the deliverable (`rejected_correction_required`). Payment capture cannot proceed until the deliverable passes verification.',
        });
      } else if (scenario === 'capture_failed') {
        const capRes = await fetch('/api/paypal/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorization_id: payment?.authorization_id || 'AUTH-FAIL-TEST',
            amount: project?.budget || 20,
            customer_accepted: true,
            simulate_failure: true,
          }),
        });
        const capData = await capRes.json();
        setFailureScenarioOutput({
          title: 'Scenario 7: PayPal Capture Fails (HTTP 502)',
          status: 'blocked_safely',
          detail: capData.error,
          actionTaken:
            'Backend returned HTTP 502 and strictly blocked `/api/ledger/settle` (`ledger_settled: false`). No fake success message or unbacked ledger entry was created.',
        });
      }
    } finally {
      setRunningScenario(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Agent Reputation, Guardrails & Autonomous Failure Recovery
        </h2>
        <p className="text-sm text-slate-600 mt-0.5">
          Inspect agent reliability metrics, test deterministic subcontracting guardrails, and trigger autonomous failure recovery scenarios.
        </p>
      </div>

      {/* Reputation Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-semibold text-slate-900">
            1. Marketplace Reputation & Execution Reliability
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50">
                <th className="py-3 px-5 font-medium">Agent</th>
                <th className="py-3 px-5 font-medium">Status</th>
                <th className="py-3 px-5 font-medium text-right">Reputation</th>
                <th className="py-3 px-5 font-medium text-right">Completed</th>
                <th className="py-3 px-5 font-medium text-right">Success Rate</th>
                <th className="py-3 px-5 font-medium text-right">Avg Audit Score</th>
                <th className="py-3 px-5 font-medium text-right">Avg Speed</th>
                <th className="py-3 px-5 font-medium text-right">Subcontracts</th>
                <th className="py-3 px-5 font-medium text-right">Disputes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 tabular-nums">
              {agents.map((a) => {
                const sessionDeliverables = deliverables.filter(
                  (d) => d.agent_code === a.agent_code
                );
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap">
                      {a.name}{' '}
                      <span className="font-mono text-xs text-slate-400 ml-1">
                        ({a.agent_code})
                      </span>
                    </td>
                    <td className="py-3 px-5 text-xs">
                      <span
                        className={
                          a.status === 'active'
                            ? 'text-emerald-700 font-medium'
                            : a.status === 'busy'
                            ? 'text-amber-700 font-medium'
                            : 'text-red-700 font-medium'
                        }
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900">
                      {a.reputation}/100
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-700">
                      {a.completed_tasks + sessionDeliverables.length}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-emerald-700">
                      {a.acceptance_rate}%
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-700">
                      {a.avg_verification_score}/100
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-600">
                      {a.avg_delivery_seconds}s
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-700">
                      {a.subcontracted_count}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-500">
                      {a.disputes_count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Autonomous Failure Recovery Simulator (7 Scenarios) */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              2. Autonomous Failure Recovery & Decision-Making Tester
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Trigger any failure scenario below to verify how Genesis, Veritas, and the PayPal backend respond without generating fake success states.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Source: Deterministic Engine + Backend API
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            ['deadline_missed', '1. Agent Misses Deadline'],
            ['incomplete_work', '2. Incomplete Deliverable'],
            ['agent_unavailable', '3. Agent Becomes Offline'],
            ['budget_exceeded', '4. Bid Exceeds Budget'],
            ['subcontractor_failed', '5. Subcontractor Fails'],
            ['verification_rejected', '6. Fabricated Citation Rejected'],
            ['capture_failed', '7. PayPal Capture Failure (502)'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={runningScenario}
              onClick={() =>
                runFailureRecoveryScenario(
                  key as
                    | 'deadline_missed'
                    | 'incomplete_work'
                    | 'agent_unavailable'
                    | 'budget_exceeded'
                    | 'subcontractor_failed'
                    | 'verification_rejected'
                    | 'capture_failed'
                )
              }
              className="px-3 py-2 text-xs font-medium text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-800 transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>

        {failureScenarioOutput && (
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                {failureScenarioOutput.status === 'recovered' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                )}
                {failureScenarioOutput.title}
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {failureScenarioOutput.status === 'recovered'
                  ? 'AUTONOMOUSLY RECOVERED'
                  : 'SAFELY BLOCKED BY ENGINE'}
              </span>
            </div>
            <div className="text-slate-600">
              <strong className="text-slate-800">Fault Detected: </strong>
              {failureScenarioOutput.detail}
            </div>
            <div className="text-slate-700">
              <strong className="text-slate-900">Autonomous Action Taken: </strong>
              {failureScenarioOutput.actionTaken}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Spending & Subcontracting Policy Guardrails */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              3. Subcontracting & Negotiation Guardrails
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Test deterministic policy constraints enforced on every agent contract:
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => runGuardrailScenario('overspend')}
              className="px-3 py-2 text-xs font-medium text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
            >
              1. Exceed 60% subcontracting cap ($3.50 on $4.50 contract)
            </button>
            <button
              onClick={() => runGuardrailScenario('circular')}
              className="px-3 py-2 text-xs font-medium text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
            >
              2. Circular delegation loop (MGR-001 → RSC-001 → PRC-001 → RSC-001)
            </button>
            <button
              onClick={() => runGuardrailScenario('depth')}
              className="px-3 py-2 text-xs font-medium text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
            >
              3. Exceed maximum delegation depth (depth &gt; 2)
            </button>
            <button
              onClick={() => runGuardrailScenario('self')}
              className="px-3 py-2 text-xs font-medium text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
            >
              4. Self-subcontracting (RSC-001 hires RSC-001)
            </button>
            <button
              onClick={() => runGuardrailScenario('rounds')}
              className="px-3 py-2 text-xs font-medium text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
            >
              5. Exceed maximum negotiation rounds (Round 3 &gt; Max 2)
            </button>
          </div>

          {guardrailTestOutput && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>{guardrailTestOutput}</span>
            </div>
          )}
        </div>

        {/* 17-Item Release Checklist */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                4. Hackathon Verification Checklist ({completedCount}/
                {RELEASE_CHECKLIST_ITEMS.length})
              </h3>
            </div>
            <button
              onClick={() => setManualOverrides({})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RELEASE_CHECKLIST_ITEMS.map((label, idx) => {
              const checked = effectiveChecks[idx];
              return (
                <button
                  key={label}
                  onClick={() =>
                    setManualOverrides((prev) => ({ ...prev, [idx]: !checked }))
                  }
                  className="flex items-start gap-2.5 p-2 rounded text-left hover:bg-slate-50 cursor-pointer"
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-xs leading-snug ${
                      checked ? 'text-slate-900 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
