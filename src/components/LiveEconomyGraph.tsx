import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import {
  AgentRecord,
  ProjectRecord,
  TaskRecord,
  ContractRecord,
  BidRecord,
  DeliverableRecord,
} from '../lib/economy/seed-agents.ts';
import { parseVerificationReport } from '../lib/protocols/aep.ts';

interface EconomyNodeData extends Record<string, unknown> {
  code: string;
  title: string;
  subtitle: string;
  roleLabel: string;
  contractAmount?: string;
  netAmount?: string;
  statusText: string;
}

function EconomyNodeCard({ data }: { data: EconomyNodeData }) {
  return (
    <div className="w-60 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-xs hover:border-slate-400 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{data.roleLabel}</span>
        <span className="font-mono text-slate-400">{data.code}</span>
      </div>
      <div className="mt-1 font-display text-sm font-semibold text-slate-900 truncate">
        {data.title}
      </div>
      <div className="mt-0.5 text-xs text-slate-500 truncate">{data.subtitle}</div>
      {data.contractAmount && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{data.statusText}</span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {data.contractAmount}
          </span>
        </div>
      )}
      {data.netAmount && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
          <span>Net kept after subcontract</span>
          <span className="font-mono font-medium tabular-nums">{data.netAmount}</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  economyNode: EconomyNodeCard,
};

interface LiveEconomyGraphProps {
  project: ProjectRecord | null;
  agents: AgentRecord[];
  tasks: TaskRecord[];
  contracts: ContractRecord[];
  bids: BidRecord[];
  deliverables: DeliverableRecord[];
}

export const LiveEconomyGraph: React.FC<LiveEconomyGraphProps> = ({
  project,
  agents,
  tasks,
  contracts,
  bids,
  deliverables,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>('RSC-001');

  const { nodes, edges } = useMemo(() => {
    const budget = project?.budget ?? 20.0;
    const scale = budget / 20.0;

    const getContractForSeller = (code: string) =>
      contracts.find((c) => c.seller_agent_code === code);

    const scoutContract = getContractForSeller('RSC-001');
    const dataMindContract = getContractForSeller('DAT-001');
    const sentimentContract = getContractForSeller('SEN-001');
    const marketPilotContract = getContractForSeller('STR-001');
    const docuMindContract = getContractForSeller('DOC-001');
    const priceCrawlerContract = getContractForSeller('PRC-001');

    const scoutGross = scoutContract?.agreed_amount ?? Number((4.5 * scale).toFixed(2));
    const subAmt = priceCrawlerContract?.agreed_amount ?? Number((1.5 * scale).toFixed(2));
    const scoutNet = Number((scoutGross - subAmt).toFixed(2));

    const primarySpecs = [
      {
        code: 'RSC-001',
        name: 'Scout',
        subtitle: 'Competitor research (v2 Verified)',
        gross: scoutGross,
        net: `$${scoutNet.toFixed(2)}`,
        edgeLabel: `Bid $4.80 → Agreed $${scoutGross.toFixed(2)}`,
        x: 30,
      },
      {
        code: 'DAT-001',
        name: 'DataMind',
        subtitle: 'Pricing & fee data',
        gross: dataMindContract?.agreed_amount ?? Number((3.5 * scale).toFixed(2)),
        net: undefined,
        edgeLabel: `Bid $3.65 → Agreed $${(
          dataMindContract?.agreed_amount ?? Number((3.5 * scale).toFixed(2))
        ).toFixed(2)}`,
        x: 310,
      },
      {
        code: 'SEN-001',
        name: 'SentimentX',
        subtitle: 'Customer reviews',
        gross: sentimentContract?.agreed_amount ?? Number((3.8 * scale).toFixed(2)),
        net: undefined,
        edgeLabel: `Bid $4.00 → Agreed $${(
          sentimentContract?.agreed_amount ?? Number((3.8 * scale).toFixed(2))
        ).toFixed(2)}`,
        x: 590,
      },
      {
        code: 'STR-001',
        name: 'MarketPilot',
        subtitle: 'Market positioning',
        gross: marketPilotContract?.agreed_amount ?? Number((3.5 * scale).toFixed(2)),
        net: undefined,
        edgeLabel: `Agreed $${(
          marketPilotContract?.agreed_amount ?? Number((3.5 * scale).toFixed(2))
        ).toFixed(2)}`,
        x: 870,
      },
      {
        code: 'DOC-001',
        name: 'DocuMind',
        subtitle: 'Final report compilation',
        gross: docuMindContract?.agreed_amount ?? Number((3.2 * scale).toFixed(2)),
        net: undefined,
        edgeLabel: `Agreed $${(
          docuMindContract?.agreed_amount ?? Number((3.2 * scale).toFixed(2))
        ).toFixed(2)}`,
        x: 1150,
      },
    ];

    const totalContractSpend = primarySpecs.reduce((s, p) => s + p.gross, 0);
    const reserveAmt = Number(Math.max(0, budget - totalContractSpend).toFixed(2));

    const builtNodes: Node<EconomyNodeData>[] = [
      {
        id: 'CUSTOMER',
        type: 'economyNode',
        position: { x: 590, y: 20 },
        data: {
          code: 'Customer',
          title: project ? project.title : 'Competitive Intelligence Project',
          subtitle: 'PayPal Delayed Capture Authorization',
          roleLabel: 'Project Buyer',
          contractAmount: `$${budget.toFixed(2)}`,
          statusText: 'Authorized',
        },
      },
      {
        id: 'MGR-001',
        type: 'economyNode',
        position: { x: 590, y: 175 },
        data: {
          code: 'MGR-001',
          title: 'Genesis',
          subtitle: `Contracts: $${totalContractSpend.toFixed(2)} · Reserve: $${reserveAmt.toFixed(2)}`,
          roleLabel: 'Lead Orchestrator',
          contractAmount: `$${totalContractSpend.toFixed(2)}`,
          statusText: 'Awarded',
        },
      },
    ];

    const builtEdges: Edge[] = [
      {
        id: 'e-cust-mgr',
        source: 'CUSTOMER',
        target: 'MGR-001',
        label: `Authorized $${budget.toFixed(2)} (Reserve: $${reserveAmt.toFixed(2)})`,
        style: { stroke: '#64748b', strokeWidth: 1.5 },
        labelStyle: { fill: '#334155', fontSize: 11, fontFamily: 'Public Sans' },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      },
    ];

    for (const spec of primarySpecs) {
      const taskObj = tasks.find((t) => t.assigned_agent_code === spec.code);
      const cntObj = getContractForSeller(spec.code);
      builtNodes.push({
        id: spec.code,
        type: 'economyNode',
        position: { x: spec.x, y: 350 },
        data: {
          code: spec.code,
          title: spec.name,
          subtitle: taskObj?.title || spec.subtitle,
          roleLabel: cntObj?.status ? `Contractor (${cntObj.status})` : 'Contractor',
          contractAmount: `$${spec.gross.toFixed(2)}`,
          netAmount: spec.net,
          statusText: spec.code === 'RSC-001' ? 'Gross contract' : 'Contract',
        },
      });

      builtEdges.push({
        id: `e-mgr-${spec.code}`,
        source: 'MGR-001',
        target: spec.code,
        label: spec.edgeLabel,
        style: { stroke: '#0f172a', strokeWidth: 1.5 },
        labelStyle: { fill: '#0f172a', fontSize: 10, fontFamily: 'Public Sans' },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
      });
    }

    // Subcontractor Node: PriceCrawler hired by Scout
    builtNodes.push({
      id: 'PRC-001',
      type: 'economyNode',
      position: { x: 30, y: 545 },
      data: {
        code: 'PRC-001',
        title: 'PriceCrawler',
        subtitle: 'Subcontract: OTA rate parity & hidden fees',
        roleLabel: 'Subcontractor (Depth 2/2)',
        contractAmount: `$${subAmt.toFixed(2)}`,
        statusText: 'Paid by Scout',
      },
    });

    builtEdges.push({
      id: 'e-scout-prc',
      source: 'RSC-001',
      target: 'PRC-001',
      label: `Subcontracted $${subAmt.toFixed(2)} (33.3% ≤ 60% cap)`,
      animated: true,
      style: { stroke: '#2563eb', strokeWidth: 2 },
      labelStyle: { fill: '#1d4ed8', fontSize: 11, fontWeight: 600, fontFamily: 'Public Sans' },
      labelBgStyle: { fill: '#eff6ff', fillOpacity: 0.95 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
    });

    // Verifier Node: Veritas
    builtNodes.push({
      id: 'VER-001',
      type: 'economyNode',
      position: { x: 590, y: 545 },
      data: {
        code: 'VER-001',
        title: 'Veritas',
        subtitle: '8-check deterministic + AI quality control',
        roleLabel: 'Independent Auditor',
        contractAmount: `${deliverables.length || 6} verified`,
        statusText: 'Audit status',
      },
    });

    for (const code of ['PRC-001', 'RSC-001', 'DAT-001', 'SEN-001', 'STR-001', 'DOC-001']) {
      builtEdges.push({
        id: `e-${code}-ver`,
        source: code,
        target: 'VER-001',
        style: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      });
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [project, tasks, contracts, deliverables]);

  const selectedAgent = agents.find((a) => a.agent_code === selectedCode);
  const selectedContract = contracts.find((c) => c.seller_agent_code === selectedCode);
  const selectedBid = bids.find((b) => b.agent_code === selectedCode);
  const selectedDeliverable = deliverables.find((d) => d.agent_code === selectedCode);
  const parsedReport = useMemo(
    () =>
      selectedDeliverable
        ? parseVerificationReport(
            selectedDeliverable.verification_feedback,
            selectedDeliverable.verification_score,
            selectedDeliverable.verification_passed
          )
        : null,
    [selectedDeliverable]
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Autonomous Delegation, Negotiation & Verification Graph
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Click any node in the graph to inspect the agent&apos;s contract terms, multi-round negotiation log, subcontracting relationship, and Veritas audit score.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* React Flow Canvas */}
        <div className="xl:col-span-8 h-[620px] rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            onNodeClick={(_e, node) => {
              if (node.id !== 'CUSTOMER') {
                setSelectedCode(node.id);
              }
            }}
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Details Panel */}
        <div className="xl:col-span-4 rounded-lg border border-slate-200 bg-white p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-500">Selected Economic Participant</div>
              <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5">
                {selectedAgent?.name || selectedCode}{' '}
                <span className="text-sm font-normal text-slate-500">
                  ({selectedAgent?.role || 'Agent'})
                </span>
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {selectedAgent?.description}
              </p>
            </div>

            {/* Agent Selector Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {[
                'MGR-001',
                'RSC-001',
                'PRC-001',
                'DAT-001',
                'SEN-001',
                'STR-001',
                'DOC-001',
                'VER-001',
              ].map((code) => {
                const ag = agents.find((a) => a.agent_code === code);
                return (
                  <button
                    key={code}
                    onClick={() => setSelectedCode(code)}
                    className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                      selectedCode === code
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {ag?.name || code}
                  </button>
                );
              })}
            </div>

            {selectedContract ? (
              <div className="space-y-2 pt-3 border-t border-slate-200 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Contract Terms</span>
                  <span className="font-mono text-xs text-slate-500">
                    Status: {selectedContract.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Buyer agent</span>
                  <span className="font-medium text-slate-900">
                    {selectedContract.buyer_agent_code === 'MGR-001'
                      ? 'Genesis (MGR-001)'
                      : 'Scout (RSC-001)'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Gross contract price</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    ${selectedContract.agreed_amount.toFixed(2)}
                  </span>
                </div>
                {selectedContract.subcontracted_amount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Subcontracted to PriceCrawler (PRC-001)</span>
                    <span className="font-mono text-slate-700 tabular-nums">
                      -${selectedContract.subcontracted_amount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-medium text-slate-900">
                  <span>Net earnings retained</span>
                  <span className="font-mono tabular-nums text-emerald-700">
                    ${selectedContract.net_amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-200 text-sm text-slate-500">
                Registered price range: ${selectedAgent?.min_price.toFixed(2)} – $
                {selectedAgent?.max_price.toFixed(2)} USD
              </div>
            )}

            {selectedBid && (
              <div className="space-y-1.5 pt-3 border-t border-slate-200 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Negotiation Lifecycle</span>
                  <span className="font-mono text-xs text-slate-500">
                    Round {selectedBid.round}/2
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 p-2.5 rounded border border-slate-200">
                  {selectedBid.negotiation_log}
                </p>
              </div>
            )}

            {selectedDeliverable && parsedReport && (
              <div className="space-y-2 pt-3 border-t border-slate-200 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    Veritas Audit (v{selectedDeliverable.version})
                  </span>
                  <span className="font-mono text-xs font-semibold text-emerald-700">
                    {selectedDeliverable.verification_score}/100 ({parsedReport.passed_count}/8 checks)
                  </span>
                </div>
                {parsedReport.correction_history &&
                  parsedReport.correction_history.length > 0 && (
                    <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded space-y-1">
                      {parsedReport.correction_history.map((h) => (
                        <div key={h.version}>
                          <strong>v{h.version}:</strong> {h.note}
                        </div>
                      ))}
                    </div>
                  )}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedDeliverable.summary}
                </p>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
            Delegation Guardrails: Max Depth = 2 · Max Subcontract = 60% · Zero Circular Loops
          </div>
        </div>
      </div>
    </div>
  );
};
