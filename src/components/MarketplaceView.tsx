import React, { useState, useMemo } from 'react';
import { AgentRecord, ContractRecord, DeliverableRecord } from '../lib/economy/seed-agents.ts';
import {
  registerCustomAgent,
  updateAgentAvailabilityStatus,
} from '../lib/economy/orchestrator-client.ts';
import {
  Plus,
  Search,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Award,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface MarketplaceViewProps {
  userId: string;
  agents: AgentRecord[];
  contracts: ContractRecord[];
  deliverables?: DeliverableRecord[];
  onAgentRegistered?: (newAgent: AgentRecord) => void;
  onAgentStatusChanged?: (agentId: string, status: 'active' | 'busy' | 'offline') => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  userId,
  agents,
  contracts,
  deliverables = [],
  onAgentRegistered,
  onAgentStatusChanged,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'busy' | 'offline'>('all');
  const [subcontractFilter, setSubcontractFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(25);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedProfileAgent, setSelectedProfileAgent] = useState<AgentRecord | null>(null);

  const [newCode, setNewCode] = useState('LGL-001');
  const [newName, setNewName] = useState('LegalResearchPro');
  const [newRole, setNewRole] = useState('Contract & Regulatory Specialist');
  const [newDesc, setNewDesc] = useState(
    'Reviews platform terms of service, commission clauses, and regulatory compliance rules across global OTAs.'
  );
  const [newSkills, setNewSkills] = useState(
    'legal_research, contract_summarization, competitor_research'
  );
  const [newMinPrice, setNewMinPrice] = useState('2.00');
  const [newMaxPrice, setNewMaxPrice] = useState('12.00');
  const [newCanSubcontract, setNewCanSubcontract] = useState(true);
  const [newSubLimit, setNewSubLimit] = useState('50');
  const [isRegistering, setIsRegistering] = useState(false);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => a.skills.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        !searchQuery.trim() ||
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.agent_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSkill = skillFilter === 'all' || agent.skills.includes(skillFilter);
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
      const matchesSub =
        subcontractFilter === 'all' ||
        (subcontractFilter === 'yes' && agent.can_subcontract) ||
        (subcontractFilter === 'no' && !agent.can_subcontract);
      const matchesPrice = agent.min_price <= maxPriceFilter;

      return matchesSearch && matchesSkill && matchesStatus && matchesSub && matchesPrice;
    });
  }, [agents, searchQuery, skillFilter, statusFilter, subcontractFilter, maxPriceFilter]);

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const created = await registerCustomAgent(userId, {
        agent_code: newCode,
        name: newName,
        role: newRole,
        description: newDesc,
        skills: newSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        min_price: Number(newMinPrice) || 2,
        max_price: Number(newMaxPrice) || 12,
        can_subcontract: newCanSubcontract,
        subcontract_limit_pct: Number(newSubLimit) || 50,
      });
      onAgentRegistered?.(created);
      setShowRegisterModal(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleToggleAvailability = async (
    agent: AgentRecord,
    nextStatus: 'active' | 'busy' | 'offline'
  ) => {
    onAgentStatusChanged?.(agent.id, nextStatus);
    await updateAgentAvailabilityStatus(userId, agent.id, nextStatus);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Autonomous Agent Marketplace ({filteredAgents.length} of {agents.length})
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Genesis dynamically searches this registry to evaluate skill match, reputation, availability, and pricing before sending RFPs.
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Agent
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-lg border border-slate-200 bg-white">
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, code, skill..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="all">All skills ({allSkills.length})</option>
            {allSkills.map((skill) => (
              <option key={skill} value={skill}>
                {skill.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'active' | 'busy' | 'offline')
            }
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="all">All statuses</option>
            <option value="active">Available (Active)</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          {(['all', 'yes', 'no'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSubcontractFilter(mode)}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subcontractFilter === mode
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'yes' ? 'Subcontracts' : 'Direct'}
            </button>
          ))}
        </div>

        <div className="md:col-span-2 flex items-center justify-between gap-2 px-2 text-xs text-slate-600">
          <span className="whitespace-nowrap font-mono tabular-nums">Min ≤ ${maxPriceFilter}</span>
          <input
            type="range"
            min={1}
            max={25}
            value={maxPriceFilter}
            onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
            className="w-20 accent-slate-900"
          />
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAgents.map((agent) => {
          const agentContracts = contracts.filter(
            (c) => c.seller_agent_code === agent.agent_code
          );
          const earnedTotal = agentContracts.reduce((sum, c) => sum + c.net_amount, 0);

          const agentDeliverables = deliverables.filter(
            (d) => d.agent_code === agent.agent_code
          );
          const totalCompletedTasks = agent.completed_tasks + agentDeliverables.length;
          const avgVerificationScore =
            agentDeliverables.length > 0
              ? Number(
                  (
                    (agent.completed_tasks * agent.avg_verification_score +
                      agentDeliverables.reduce((sum, d) => sum + d.verification_score, 0)) /
                    Math.max(1, totalCompletedTasks)
                  ).toFixed(1)
                )
              : agent.avg_verification_score;

          return (
            <div
              key={agent.id}
              className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3.5">
                {/* Metadata Header + Live Availability Switcher */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-slate-700">
                      {agent.agent_code}
                    </span>
                    <span>·</span>
                    <span
                      className={
                        agent.status === 'active'
                          ? 'text-emerald-700 font-medium'
                          : agent.status === 'busy'
                          ? 'text-amber-700 font-medium'
                          : 'text-red-700 font-medium'
                      }
                    >
                      {agent.status === 'active'
                        ? 'Available'
                        : agent.status === 'busy'
                        ? 'Busy'
                        : 'Offline (Unavailable)'}
                    </span>
                  </div>

                  {agent.agent_code !== 'MGR-001' && agent.agent_code !== 'VER-001' && (
                    <div
                      className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-[11px]"
                      title="Toggle agent availability to test Genesis dynamic failover when an agent goes offline"
                    >
                      {(['active', 'offline'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleToggleAvailability(agent, st)}
                          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                            agent.status === st
                              ? 'bg-white text-slate-900 font-medium shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {st === 'active' ? 'Online' : 'Set Offline'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    {agent.name}
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">{agent.role}</div>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{agent.description}</p>

                {/* Summary Stats Card for each agent */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>Performance Summary</span>
                    <span className="font-mono text-slate-700">
                      Reputation: {agent.reputation}/100
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded bg-white border border-slate-200/80 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                        <span>Completed Tasks</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                          {totalCompletedTasks}
                        </span>
                        {agentDeliverables.length > 0 && (
                          <span className="font-mono text-[11px] text-emerald-700">
                            +{agentDeliverables.length} new
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded bg-white border border-slate-200/80 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Avg. Verification</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                          {avgVerificationScore}
                        </span>
                        <span className="font-mono text-xs text-slate-500">/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <div className="font-mono font-semibold text-slate-900 tabular-nums">
                        {agent.acceptance_rate}%
                      </div>
                      <div className="text-[11px] text-slate-500">Success rate</div>
                    </div>
                    <div>
                      <div className="font-mono font-semibold text-slate-900 tabular-nums">
                        {agent.avg_delivery_seconds}s
                      </div>
                      <div className="text-[11px] text-slate-500">Avg. speed</div>
                    </div>
                    <div>
                      <div className="font-mono font-semibold text-slate-900 tabular-nums">
                        ${agent.min_price.toFixed(2)}–${agent.max_price.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-slate-500">Price range</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Skills: </span>
                  {agent.skills.map((s) => s.replace(/_/g, ' ')).join(' · ')}
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>
                    Subcontracting:{' '}
                    <strong className="font-medium text-slate-700">
                      {agent.can_subcontract
                        ? `Allowed (up to ${agent.subcontract_limit_pct}%)`
                        : 'Direct only'}
                    </strong>
                  </span>
                  {earnedTotal > 0 && (
                    <span className="font-mono font-medium text-emerald-700 tabular-nums">
                      Session: +${earnedTotal.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedProfileAgent(agent)}
                    className="w-full py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Inspect Agent Profile & Capabilities
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Detailed Profile Modal */}
      {selectedProfileAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 space-y-5 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-mono text-slate-500">
                  {selectedProfileAgent.agent_code} · Model: {selectedProfileAgent.model}
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  {selectedProfileAgent.name} — {selectedProfileAgent.role}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProfileAgent(null)}
                className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Capability Overview
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {selectedProfileAgent.description}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-md border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Award className="w-3.5 h-3.5 text-slate-700" />
                    <span>Reputation</span>
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-900 mt-1 tabular-nums">
                    {selectedProfileAgent.reputation}/100
                  </div>
                </div>

                <div className="p-3 rounded-md border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                    <span>Completed</span>
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-900 mt-1 tabular-nums">
                    {selectedProfileAgent.completed_tasks +
                      deliverables.filter(
                        (d) => d.agent_code === selectedProfileAgent.agent_code
                      ).length}{' '}
                    contracts
                  </div>
                </div>

                <div className="p-3 rounded-md border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Avg. Audit Score</span>
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-900 mt-1 tabular-nums">
                    {selectedProfileAgent.avg_verification_score}/100
                  </div>
                </div>

                <div className="p-3 rounded-md border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-700" />
                    <span>Avg. Execution</span>
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-900 mt-1 tabular-nums">
                    {selectedProfileAgent.avg_delivery_seconds}s
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Economic & Governance Parameters</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 font-mono">
                  <div>
                    Price Bounds: ${selectedProfileAgent.min_price.toFixed(2)} – $
                    {selectedProfileAgent.max_price.toFixed(2)} USD
                  </div>
                  <div>
                    Subcontract Cap:{' '}
                    {selectedProfileAgent.can_subcontract
                      ? `${selectedProfileAgent.subcontract_limit_pct}% of contract`
                      : '0% (Disabled)'}
                  </div>
                  <div>
                    Max Concurrency: {selectedProfileAgent.max_concurrent_tasks} tasks
                  </div>
                  <div>
                    Historical Subcontracts: {selectedProfileAgent.subcontracted_count}
                  </div>
                  <div>Historical Disputes: {selectedProfileAgent.disputes_count}</div>
                  <div>Status: {selectedProfileAgent.status.toUpperCase()}</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Registered Marketplace Skills
                </div>
                <div className="text-xs font-mono text-slate-800 bg-slate-50 p-3 rounded-md border border-slate-200">
                  {selectedProfileAgent.skills.join(' · ')}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Autonomous System Instruction Prompt
                </div>
                <div className="text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-200 leading-relaxed">
                  {selectedProfileAgent.system_prompt}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedProfileAgent(null)}
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Register New Autonomous Agent
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleRegisterAgent} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Agent Code</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Agent Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Role</label>
                <input
                  type="text"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Skills (comma-separated — matched by Genesis during discovery)
                </label>
                <input
                  type="text"
                  required
                  value={newSkills}
                  onChange={(e) => setNewSkills(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Min Price ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newMinPrice}
                    onChange={(e) => setNewMinPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Max Price ($)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newMaxPrice}
                    onChange={(e) => setNewMaxPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Subcontract Cap (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={newSubLimit}
                    disabled={!newCanSubcontract}
                    onChange={(e) => setNewSubLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-slate-900 font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCanSubcontract}
                  onChange={(e) => setNewCanSubcontract(e.target.checked)}
                />
                <span>Allow this agent to subcontract part of its work to other agents</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isRegistering ? 'Saving...' : 'Register Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
