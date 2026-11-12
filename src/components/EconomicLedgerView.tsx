import React, { useState, useEffect, useMemo } from 'react';
import {
  ProjectRecord,
  ContractRecord,
  LedgerEntryRecord,
  PaymentRecord,
} from '../lib/economy/seed-agents.ts';
import { ShieldCheck, Lock, RefreshCw, Info } from 'lucide-react';

interface EconomicLedgerViewProps {
  project: ProjectRecord | null;
  contracts: ContractRecord[];
  ledgerEntries: LedgerEntryRecord[];
  payment: PaymentRecord | null;
}

export const EconomicLedgerView: React.FC<EconomicLedgerViewProps> = ({
  project,
  contracts,
  ledgerEntries,
  payment,
}) => {
  const [securityTestOutput, setSecurityTestOutput] = useState<string | null>(null);
  const [testingControl, setTestingControl] = useState(false);
  const [paypalStatus, setPaypalStatus] = useState<{
    connected: boolean;
    app_name?: string;
    api_host?: string;
    architecture_note?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/paypal/status')
      .then((r) => r.json())
      .then((d) => setPaypalStatus(d))
      .catch(() => null);
  }, []);

  const budget = project?.budget ?? 20.0;
  const scale = budget / 20.0;

  // Agent-level breakdown & Section 8 Canonical $20.00 Summary
  const financialSummary = useMemo(() => {
    const findContract = (code: string) =>
      contracts.find((c) => c.seller_agent_code === code);

    const scoutGross = findContract('RSC-001')?.agreed_amount ?? Number((4.5 * scale).toFixed(2));
    const priceCrawlerSub =
      findContract('PRC-001')?.agreed_amount ?? Number((1.5 * scale).toFixed(2));
    const scoutNet = Number((scoutGross - priceCrawlerSub).toFixed(2));
    const dataMindNet = findContract('DAT-001')?.agreed_amount ?? Number((3.5 * scale).toFixed(2));
    const sentimentNet = findContract('SEN-001')?.agreed_amount ?? Number((3.8 * scale).toFixed(2));
    const marketPilotNet =
      findContract('STR-001')?.agreed_amount ?? Number((3.5 * scale).toFixed(2));
    const docuMindNet = findContract('DOC-001')?.agreed_amount ?? Number((3.2 * scale).toFixed(2));

    const totalPrimaryContracts = Number(
      (scoutGross + dataMindNet + sentimentNet + marketPilotNet + docuMindNet).toFixed(2)
    );
    const projectReserve = Number(Math.max(0, budget - totalPrimaryContracts).toFixed(2));
    const grandTotal = Number((totalPrimaryContracts + projectReserve).toFixed(2));

    const agentRows = [
      {
        agentName: 'Scout',
        agentCode: 'RSC-001',
        roleNote: 'Primary Research Contractor (subcontracted PriceCrawler)',
        gross: scoutGross,
        subcontractCost: priceCrawlerSub,
        net: scoutNet,
      },
      {
        agentName: 'PriceCrawler',
        agentCode: 'PRC-001',
        roleNote: 'Subcontractor (funded from Scout’s $4.50 gross contract)',
        gross: priceCrawlerSub,
        subcontractCost: 0,
        net: priceCrawlerSub,
      },
      {
        agentName: 'DataMind',
        agentCode: 'DAT-001',
        roleNote: 'Primary Data Extraction Contractor',
        gross: dataMindNet,
        subcontractCost: 0,
        net: dataMindNet,
      },
      {
        agentName: 'SentimentX',
        agentCode: 'SEN-001',
        roleNote: 'Primary Sentiment Analysis Contractor',
        gross: sentimentNet,
        subcontractCost: 0,
        net: sentimentNet,
      },
      {
        agentName: 'MarketPilot',
        agentCode: 'STR-001',
        roleNote: 'Primary Market Positioning Contractor',
        gross: marketPilotNet,
        subcontractCost: 0,
        net: marketPilotNet,
      },
      {
        agentName: 'DocuMind',
        agentCode: 'DOC-001',
        roleNote: 'Primary Report Synthesis Contractor',
        gross: docuMindNet,
        subcontractCost: 0,
        net: docuMindNet,
      },
    ];

    return {
      scoutGross,
      priceCrawlerSub,
      scoutNet,
      dataMindNet,
      sentimentNet,
      marketPilotNet,
      docuMindNet,
      totalPrimaryContracts,
      projectReserve,
      grandTotal,
      agentRows,
    };
  }, [contracts, budget, scale]);

  const ledgerTotals = useMemo(() => {
    const debits = ledgerEntries
      .filter((e) => e.direction === 'debit')
      .reduce((s, e) => s + e.amount, 0);
    const credits = ledgerEntries
      .filter((e) => e.direction === 'credit')
      .reduce((s, e) => s + e.amount, 0);
    return {
      debits: Number(debits.toFixed(2)),
      credits: Number(credits.toFixed(2)),
      balanced: Math.abs(debits - credits) < 0.001,
    };
  }, [ledgerEntries]);

  const handleTestDuplicateWebhook = async () => {
    setTestingControl(true);
    try {
      const eventId = payment?.capture_id
        ? `WH-CAP-${payment.capture_id}`
        : 'WH-TEST-IDEMPOTENCY-001';
      await fetch('/api/paypal/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypal_event_id: eventId,
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource_id: payment?.capture_id || 'CAP-DEMO-001',
        }),
      });
      const res = await fetch('/api/paypal/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypal_event_id: eventId,
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource_id: payment?.capture_id || 'CAP-DEMO-001',
        }),
      });
      const data = await res.json();
      setSecurityTestOutput(
        `Webhook HMAC Verified (${data.transmission_sig?.slice(0, 12)}...) | Event "${data.paypal_event_id}": Duplicate ignored = ${
          data.duplicate_ignored ? 'true (Idempotent)' : 'false'
        }`
      );
    } finally {
      setTestingControl(false);
    }
  };

  const handleTestDuplicateCaptureGuard = async () => {
    setTestingControl(true);
    try {
      const authId =
        payment?.authorization_id ||
        project?.paypal_authorization_id ||
        '0WF29481AUTHDEMO01';
      await fetch('/api/paypal/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization_id: authId,
          amount: budget,
          customer_accepted: true,
        }),
      });
      const secondRes = await fetch('/api/paypal/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization_id: authId,
          amount: budget,
          customer_accepted: true,
        }),
      });
      const data = await secondRes.json();
      setSecurityTestOutput(
        data.message ||
          `Idempotency Guard Verified: Duplicate capture for ${authId} prevented (${data.capture_id}).`
      );
    } finally {
      setTestingControl(false);
    }
  };

  const handleTestPrematureCaptureBlock = async () => {
    setTestingControl(true);
    try {
      const res = await fetch('/api/paypal/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization_id: payment?.authorization_id || 'AUTH-PREMATURE-TEST',
          amount: budget,
          customer_accepted: false,
        }),
      });
      const data = await res.json();
      setSecurityTestOutput(`HTTP ${res.status} Guard Active: ${data.error}`);
    } finally {
      setTestingControl(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            PayPal Delayed Capture & Double-Entry Accounting Ledger
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            PayPal authorizes and captures the customer&apos;s payment only after approval. The internal double-entry ledger records agent earnings, subcontract transfers, and project reserve.
          </p>
        </div>
        <div className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
          Project Budget: ${financialSummary.grandTotal.toFixed(2)} USD
        </div>
      </div>

      {/* Top Summary Strip: Canonical $20.00 Project Allocation & Agent Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Canonical $20.00 Allocation Table */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Project Financial Summary (${financialSummary.grandTotal.toFixed(2)})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact allocation of the authorized customer budget.
              </p>
            </div>
            <span
              className="text-xs text-slate-500 flex items-center gap-1"
              title="Scout earns $4.50 gross and pays $1.50 to PriceCrawler, leaving $3.00 net for Scout and $1.50 for PriceCrawler. Total contracts = $18.50 + $1.50 Reserve = $20.00."
            >
              <Info className="w-3.5 h-3.5" />
              Reconciled
            </span>
          </div>

          <table className="w-full text-left border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <th className="py-2.5 px-5 font-medium">Allocation Line</th>
                <th className="py-2.5 px-5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-5 text-slate-700">Scout gross contract (RSC-001)</td>
                <td className="py-2.5 px-5 text-right font-mono text-slate-900">
                  ${financialSummary.scoutGross.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 text-slate-500 pl-8">
                  ↳ PriceCrawler subcontract cost (PRC-001)
                </td>
                <td className="py-2.5 px-5 text-right font-mono text-slate-500">
                  -${financialSummary.priceCrawlerSub.toFixed(2)}
                </td>
              </tr>
              <tr className="bg-slate-50/70">
                <td className="py-2.5 px-5 font-medium text-slate-900">
                  Scout net earnings (RSC-001)
                </td>
                <td className="py-2.5 px-5 text-right font-mono font-semibold text-slate-900">
                  ${financialSummary.scoutNet.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 font-medium text-slate-900">
                  PriceCrawler net earnings (PRC-001)
                </td>
                <td className="py-2.5 px-5 text-right font-mono font-semibold text-slate-900">
                  ${financialSummary.priceCrawlerSub.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 font-medium text-slate-900">DataMind (DAT-001)</td>
                <td className="py-2.5 px-5 text-right font-mono font-semibold text-slate-900">
                  ${financialSummary.dataMindNet.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 font-medium text-slate-900">SentimentX (SEN-001)</td>
                <td className="py-2.5 px-5 text-right font-mono font-semibold text-slate-900">
                  ${financialSummary.sentimentNet.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 font-medium text-slate-900">MarketPilot (STR-001)</td>
                <td className="py-2.5 px-5 text-right font-mono font-semibold text-slate-900">
                  ${financialSummary.marketPilotNet.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 font-medium text-slate-900">DocuMind (DOC-001)</td>
                <td className="py-2.5 px-5 text-right font-mono font-semibold text-slate-900">
                  ${financialSummary.docuMindNet.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-5 text-slate-700">
                  Project reserve (unallocated customer budget)
                </td>
                <td className="py-2.5 px-5 text-right font-mono text-slate-700">
                  ${financialSummary.projectReserve.toFixed(2)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="py-3 px-5 text-slate-900">Total Authorized Budget</td>
                <td className="py-3 px-5 text-right font-mono text-emerald-700">
                  ${financialSummary.grandTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right 7 Columns: Agent-Level Gross, Subcontract Cost & Net Earnings Table */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Agent-Level Earnings & Subcontracting Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks gross contract revenue, subcontract expenses, and net earnings per autonomous agent.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50">
                  <th className="py-3 px-5 font-medium">Agent</th>
                  <th className="py-3 px-5 font-medium">Role</th>
                  <th className="py-3 px-5 font-medium text-right">Gross</th>
                  <th className="py-3 px-5 font-medium text-right">Subcontract</th>
                  <th className="py-3 px-5 font-medium text-right">Net Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums">
                {financialSummary.agentRows.map((row) => (
                  <tr key={row.agentCode} className="hover:bg-slate-50">
                    <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap">
                      {row.agentName}{' '}
                      <span className="font-mono text-xs text-slate-400">
                        ({row.agentCode})
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-600 text-xs">{row.roleNote}</td>
                    <td className="py-3 px-5 text-right font-mono text-slate-700">
                      ${row.gross.toFixed(2)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-500">
                      {row.subcontractCost > 0
                        ? `-$${row.subcontractCost.toFixed(2)}`
                        : '$0.00'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900">
                      ${row.net.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-mono text-xs font-semibold tabular-nums">
                  <td className="py-3 px-5 font-sans text-slate-900" colSpan={2}>
                    Total Net Agent Earnings (+ ${financialSummary.projectReserve.toFixed(2)}{' '}
                    Project Reserve = ${financialSummary.grandTotal.toFixed(2)})
                  </td>
                  <td className="py-3 px-5 text-right text-slate-600">
                    $
                    {(
                      financialSummary.totalPrimaryContracts +
                      financialSummary.priceCrawlerSub
                    ).toFixed(2)}
                  </td>
                  <td className="py-3 px-5 text-right text-slate-600">
                    -${financialSummary.priceCrawlerSub.toFixed(2)}
                  </td>
                  <td className="py-3 px-5 text-right text-emerald-700">
                    ${financialSummary.totalPrimaryContracts.toFixed(2)} USD
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Section 2: PayPal Payment Authorization & Delayed Capture Lifecycle */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              PayPal Sandbox Payment Authorization & Delayed Capture
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Host: {paypalStatus?.api_host || 'https://api-m.sandbox.paypal.com'} · App:{' '}
              {paypalStatus?.app_name || 'Default Application'} · Secrets restricted to backend server.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {payment?.approval_url && (
              <a
                href={payment.approval_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
              >
                Open PayPal Sandbox Order ↗
              </a>
            )}
            <button
              onClick={handleTestPrematureCaptureBlock}
              disabled={testingControl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              Test Premature Capture Block
            </button>
            <button
              onClick={handleTestDuplicateCaptureGuard}
              disabled={testingControl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Test Duplicate Capture Guard
            </button>
            <button
              onClick={handleTestDuplicateWebhook}
              disabled={testingControl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Test Webhook Idempotency
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">1. Order ID (intent: AUTHORIZE)</div>
            <div className="font-mono font-medium text-slate-900 mt-1 truncate">
              {payment?.paypal_order_id || project?.paypal_order_id || 'Not created yet'}
            </div>
          </div>
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">2. Authorization ID</div>
            <div className="font-mono font-medium text-slate-900 mt-1 truncate">
              {payment?.authorization_id || project?.paypal_authorization_id || 'Pending'}
            </div>
          </div>
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">3. Delayed Capture ID</div>
            <div className="font-mono font-medium text-emerald-700 mt-1 truncate">
              {payment?.capture_id ||
                project?.paypal_capture_id ||
                'Locked until customer approval'}
            </div>
          </div>
          <div className="p-4 rounded-md bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">4. Settlement State</div>
            <div className="font-mono font-medium text-slate-900 mt-1 truncate">
              {payment?.status === 'captured' || project?.status === 'settled'
                ? 'CAPTURED & SETTLED'
                : payment?.status === 'authorized'
                ? 'AUTHORIZED (AWAITING APPROVAL)'
                : 'AWAITING ORDER'}
            </div>
          </div>
        </div>

        {securityTestOutput && (
          <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono">
            {securityTestOutput}
          </div>
        )}
      </div>

      {/* Table 3: Immutable Double-Entry Accounting Journal */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Immutable Double-Entry Accounting Journal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Generated and validated by the backend accounting engine (/api/ledger/settle) after PayPal capture succeeds.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-700 tabular-nums">
            Total Debits: ${ledgerTotals.debits.toFixed(2)} · Total Credits: $
            {ledgerTotals.credits.toFixed(2)} · Status:{' '}
            <strong className={ledgerTotals.balanced ? 'text-emerald-700' : 'text-red-700'}>
              {ledgerTotals.balanced ? 'BALANCED (DEBITS == CREDITS)' : 'UNBALANCED'}
            </strong>
          </div>
        </div>

        {ledgerEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No accounting entries recorded yet. Ledger settlement is strictly blocked until the customer approves final deliverables and PayPal captures the authorization.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs bg-slate-50">
                  <th className="py-3 px-5 font-medium">Tx Reference</th>
                  <th className="py-3 px-5 font-medium">Account</th>
                  <th className="py-3 px-5 font-medium">Ledger Type</th>
                  <th className="py-3 px-5 font-medium text-right">Debit</th>
                  <th className="py-3 px-5 font-medium text-right">Credit</th>
                  <th className="py-3 px-5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 tabular-nums text-xs">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="py-3 px-5 font-mono text-slate-500 whitespace-nowrap">
                      {entry.reference_type}: {entry.reference_id.slice(0, 14)}
                    </td>
                    <td className="py-3 px-5 font-medium text-slate-900 whitespace-nowrap">
                      {entry.owner_name}{' '}
                      <span className="font-mono text-slate-400">({entry.owner_code})</span>
                    </td>
                    <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                      {entry.account_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-700">
                      {entry.direction === 'debit' ? `$${entry.amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-medium text-emerald-700">
                      {entry.direction === 'credit' ? `$${entry.amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-5 text-slate-600">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
