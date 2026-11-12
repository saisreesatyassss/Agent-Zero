export interface AgentRecord {
  id: string;
  agent_code: string;
  name: string;
  role: string;
  description: string;
  system_prompt: string;
  model: string;
  min_price: number;
  max_price: number;
  max_concurrent_tasks: number;
  can_subcontract: boolean;
  subcontract_limit_pct: number;
  reputation: number;
  completed_tasks: number;
  acceptance_rate: number;
  avg_verification_score: number;
  avg_delivery_seconds: number;
  subcontracted_count: number;
  disputes_count: number;
  skills: string[];
  status: 'active' | 'busy' | 'offline';
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  customer_id: string;
  ownerId: string;
  budget: number;
  allocated_budget: number;
  currency: 'USD';
  status:
    | 'created'
    | 'payment_authorized'
    | 'decomposing'
    | 'bidding'
    | 'contracted'
    | 'executing'
    | 'verifying'
    | 'delivered'
    | 'settled'
    | 'cancelled'
    | 'disputed';
  execution_mode: 'autonomous' | 'step_by_step';
  paypal_order_id: string;
  paypal_authorization_id: string;
  paypal_capture_id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskRecord {
  id: string;
  project_id: string;
  parent_task_id: string;
  delegation_depth: number;
  title: string;
  description: string;
  required_skills: string[];
  allocated_budget: number;
  agreed_price: number;
  status:
    | 'open'
    | 'discoverable'
    | 'bidding'
    | 'contracted'
    | 'executing'
    | 'submitted'
    | 'verified'
    | 'settled'
    | 'rejected'
    | 'failed'
    | 'cancelled'
    | 'disputed';
  buyer_agent_id: string;
  buyer_agent_code: string;
  assigned_agent_id: string;
  assigned_agent_code: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BidRecord {
  id: string;
  project_id: string;
  task_id: string;
  agent_id: string;
  agent_code: string;
  agent_name: string;
  buyer_agent_code: string;
  initial_offer: number;
  proposed_price: number;
  final_price: number;
  estimated_minutes: number;
  proposal: string;
  negotiation_log: string;
  status: 'submitted' | 'countered' | 'accepted' | 'rejected';
  round: number;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ContractRecord {
  id: string;
  project_id: string;
  task_id: string;
  parent_task_id: string;
  buyer_agent_id: string;
  buyer_agent_code: string;
  seller_agent_id: string;
  seller_agent_code: string;
  seller_agent_name: string;
  bid_id: string;
  agreed_amount: number;
  subcontracted_amount: number;
  net_amount: number;
  currency: 'USD';
  terms_summary: string;
  status: 'active' | 'completed' | 'settled' | 'disputed' | 'cancelled';
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeliverableRecord {
  id: string;
  project_id: string;
  task_id: string;
  agent_id: string;
  agent_code: string;
  agent_name: string;
  title: string;
  summary: string;
  content_markdown: string;
  evidence_items: string[];
  version: number;
  verification_score: number;
  verification_passed: boolean;
  verification_feedback: string;
  verifier_agent_code: string;
  status: 'submitted' | 'verified' | 'accepted' | 'rejected';
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LedgerEntryRecord {
  id: string;
  project_id: string;
  transaction_group_id: string;
  account_id: string;
  owner_type: 'customer' | 'escrow' | 'agent';
  owner_code: string;
  owner_name: string;
  account_type: 'funding' | 'escrow_liability' | 'gross_revenue' | 'subcontract_expense' | 'net_earnings';
  direction: 'debit' | 'credit';
  amount: number;
  currency: 'USD';
  reference_type: string;
  reference_id: string;
  description: string;
  ownerId: string;
  createdAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  project_id: string;
  paypal_order_id: string;
  authorization_id: string;
  capture_id: string;
  amount: number;
  currency: 'USD';
  status: 'created' | 'approved' | 'authorized' | 'captured' | 'voided' | 'refunded';
  mode: 'paypal_sandbox_live' | 'paypal_sandbox_protocol';
  approval_url: string;
  webhook_verified: boolean;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AgentMessageRecord {
  id: string;
  project_id: string;
  protocol: 'AEP/1.0';
  message_id: string;
  message_type:
    | 'TASK_PUBLISH'
    | 'TASK_DISCOVER'
    | 'BID_SUBMIT'
    | 'BID_REJECT'
    | 'BID_COUNTER'
    | 'CONTRACT_AWARD'
    | 'SUBTASK_CREATE'
    | 'TASK_START'
    | 'DELIVERABLE_SUBMIT'
    | 'VERIFICATION_RESULT'
    | 'PAYMENT_APPROVAL'
    | 'LEDGER_CREDIT';
  sender_agent_code: string;
  recipient_agent_code: string;
  task_id: string;
  summary: string;
  payload_json: string;
  ownerId: string;
  createdAt?: unknown;
}

export const INITIAL_AGENTS_SEED: Omit<AgentRecord, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[] = [
  {
    agent_code: 'MGR-001',
    name: 'Genesis',
    role: 'Principal Task Orchestrator',
    description:
      'Autonomous orchestrator responsible for decomposing customer intent into discrete economic work units, soliciting marketplace bids, negotiating commercial contracts, and managing overall budget compliance.',
    system_prompt:
      'You are Genesis (MGR-001), the Principal Task Orchestrator in AGENT ZERO. Decompose complex customer requests into well-scoped subtasks with strict budget allocations, discover capable specialist agents, and negotiate fair commercial agreements without exceeding total project budget.',
    model: 'gemini-3.8-flash',
    min_price: 0,
    max_price: 25,
    max_concurrent_tasks: 5,
    can_subcontract: true,
    subcontract_limit_pct: 100,
    reputation: 98,
    completed_tasks: 64,
    acceptance_rate: 98,
    avg_verification_score: 96,
    avg_delivery_seconds: 14,
    subcontracted_count: 64,
    disputes_count: 0,
    skills: ['task_orchestration', 'budget_allocation', 'contract_negotiation', 'project_planning'],
    status: 'active',
  },
  {
    agent_code: 'RSC-001',
    name: 'Scout',
    role: 'Research Specialist · Autonomous Agent',
    description:
      'Deep competitive intelligence and web source discovery agent. Specializes in multi-platform market mapping, source verification, and delegating specialized pricing crawls to subcontractors when cost-effective.',
    system_prompt:
      'You are Scout (RSC-001), a senior competitive intelligence researcher. Deliver comprehensive platform profiles, business models, global inventory footprints, and verified industry citations.',
    model: 'gemini-3.8-flash',
    min_price: 2.0,
    max_price: 8.0,
    max_concurrent_tasks: 3,
    can_subcontract: true,
    subcontract_limit_pct: 60,
    reputation: 96,
    completed_tasks: 42,
    acceptance_rate: 92,
    avg_verification_score: 94,
    avg_delivery_seconds: 19,
    subcontracted_count: 14,
    disputes_count: 1,
    skills: ['competitor_research', 'web_extraction', 'source_verification', 'market_intelligence'],
    status: 'active',
  },
  {
    agent_code: 'DAT-001',
    name: 'DataMind',
    role: 'Quantitative Data Extraction & Benchmarking',
    description:
      'Extracts, normalizes, and cross-tabulates quantitative metrics, commission tiers, take-rates, and unit economics across competing platforms.',
    system_prompt:
      'You are DataMind (DAT-001), a quantitative data analyst. Construct high-precision markdown comparison tables, fee breakdowns, take-rate benchmarks, and unit economics metrics.',
    model: 'gemini-3.8-flash',
    min_price: 2.5,
    max_price: 7.5,
    max_concurrent_tasks: 3,
    can_subcontract: true,
    subcontract_limit_pct: 50,
    reputation: 94,
    completed_tasks: 38,
    acceptance_rate: 95,
    avg_verification_score: 93,
    avg_delivery_seconds: 17,
    subcontracted_count: 6,
    disputes_count: 0,
    skills: ['data_extraction', 'quantitative_analysis', 'pricing_benchmarks', 'normalization'],
    status: 'active',
  },
  {
    agent_code: 'SEN-001',
    name: 'SentimentX',
    role: 'Customer Sentiment & Review Intelligence',
    description:
      'Analyzes verified buyer reviews, NPS drivers, cancellation friction points, loyalty program perception, and customer support satisfaction scores.',
    system_prompt:
      'You are SentimentX (SEN-001), a customer sentiment specialist. Quantify positive and negative sentiment drivers, trust scores, loyalty satisfaction, and support pain points across platforms.',
    model: 'gemini-3.8-flash',
    min_price: 2.5,
    max_price: 7.0,
    max_concurrent_tasks: 3,
    can_subcontract: false,
    subcontract_limit_pct: 0,
    reputation: 93,
    completed_tasks: 31,
    acceptance_rate: 94,
    avg_verification_score: 91,
    avg_delivery_seconds: 16,
    subcontracted_count: 0,
    disputes_count: 1,
    skills: ['sentiment_analysis', 'review_mining', 'nps_benchmarking', 'customer_experience'],
    status: 'active',
  },
  {
    agent_code: 'STR-001',
    name: 'MarketPilot',
    role: 'Strategic Positioning & GTM Advisor',
    description:
      'Evaluates competitive moats, geographic concentration, B2B vs. B2C segmentation, and actionable strategic recommendations for market entry and differentiation.',
    system_prompt:
      'You are MarketPilot (STR-001), a strategic positioning analyst. Map competitive quadrants, defensive moats, margin pressures, and concrete executive recommendations.',
    model: 'gemini-3.8-flash',
    min_price: 3.0,
    max_price: 9.0,
    max_concurrent_tasks: 3,
    can_subcontract: false,
    subcontract_limit_pct: 0,
    reputation: 95,
    completed_tasks: 29,
    acceptance_rate: 96,
    avg_verification_score: 95,
    avg_delivery_seconds: 21,
    subcontracted_count: 0,
    disputes_count: 0,
    skills: ['strategic_analysis', 'market_positioning', 'gtm_strategy', 'competitive_moats'],
    status: 'active',
  },
  {
    agent_code: 'DOC-001',
    name: 'DocuMind',
    role: 'Executive Report Synthesis & Compilation',
    description:
      'Synthesizes multi-agent findings into board-ready executive intelligence dossiers with structured tables, executive takeaways, and unified source bibliographies.',
    system_prompt:
      'You are DocuMind (DOC-001), an executive report architect. Synthesize research, pricing, sentiment, and strategy into a cohesive, decision-ready executive brief.',
    model: 'gemini-3.8-flash',
    min_price: 2.0,
    max_price: 6.5,
    max_concurrent_tasks: 4,
    can_subcontract: false,
    subcontract_limit_pct: 0,
    reputation: 92,
    completed_tasks: 47,
    acceptance_rate: 96,
    avg_verification_score: 92,
    avg_delivery_seconds: 15,
    subcontracted_count: 0,
    disputes_count: 0,
    skills: ['report_generation', 'executive_synthesis', 'document_structuring', 'citation_audit'],
    status: 'active',
  },
  {
    agent_code: 'VER-001',
    name: 'Veritas',
    role: 'Independent Deliverable Auditor & Verifier',
    description:
      'Audits submitted agent deliverables for factual completeness, quantitative rigor, citation integrity, and adherence to contract terms before settlement.',
    system_prompt:
      'You are Veritas (VER-001), the independent verification auditor in AGENT ZERO. Inspect deliverables strictly against contract requirements and evidence standards.',
    model: 'gemini-3.8-flash',
    min_price: 1.0,
    max_price: 4.0,
    max_concurrent_tasks: 5,
    can_subcontract: false,
    subcontract_limit_pct: 0,
    reputation: 99,
    completed_tasks: 85,
    acceptance_rate: 99,
    avg_verification_score: 98,
    avg_delivery_seconds: 11,
    subcontracted_count: 0,
    disputes_count: 0,
    skills: ['independent_verification', 'quality_assurance', 'evidence_validation', 'compliance_audit'],
    status: 'active',
  },
  {
    agent_code: 'PRC-001',
    name: 'PriceCrawler',
    role: 'Subcontractor · Granular Pricing & Fee Extractor',
    description:
      'Specialized micro-agent hired by primary contractors (such as Scout or DataMind) to extract hidden resort fees, OTA host commissions, and dynamic rate parity deltas.',
    system_prompt:
      'You are PriceCrawler (PRC-001), a specialized pricing subcontractor. Extract exact commission rates, service fee structures, markup deltas, and rate parity rules with URLs.',
    model: 'gemini-3.8-flash',
    min_price: 1.0,
    max_price: 3.5,
    max_concurrent_tasks: 4,
    can_subcontract: false,
    subcontract_limit_pct: 0,
    reputation: 91,
    completed_tasks: 24,
    acceptance_rate: 92,
    avg_verification_score: 90,
    avg_delivery_seconds: 12,
    subcontracted_count: 0,
    disputes_count: 0,
    skills: ['competitor_pricing', 'rate_parity_extraction', 'fee_decomposition'],
    status: 'active',
  },
];
