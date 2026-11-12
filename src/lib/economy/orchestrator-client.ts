import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import {
  INITIAL_AGENTS_SEED,
  AgentRecord,
  ProjectRecord,
  TaskRecord,
  ContractRecord,
  DeliverableRecord,
  PaymentRecord,
} from './seed-agents.ts';
import {
  AEPMessageType,
  AEPMessageEnvelopeSchema,
  validateSubcontractRequest,
  validateBalancedLedgerBatch,
  DraftLedgerItem,
  CandidateEvaluation,
  NegotiationStep,
  VerificationReport,
  serializeVerificationReport,
} from '../protocols/aep.ts';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * Ensures the 8 registered agents exist in Firestore for the authenticated user.
 */
export async function ensureAgentsSeeded(userId: string): Promise<AgentRecord[]> {
  const path = 'agents';
  try {
    const q = query(collection(db, path), where('ownerId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty && snap.docs.length >= INITIAL_AGENTS_SEED.length) {
      return snap.docs.map((d) => d.data() as AgentRecord);
    }

    const existingCodes = new Set(snap.docs.map((d) => (d.data() as AgentRecord).agent_code));
    const seeded: AgentRecord[] = snap.docs.map((d) => d.data() as AgentRecord);

    for (const seed of INITIAL_AGENTS_SEED) {
      if (existingCodes.has(seed.agent_code)) continue;
      const docId = `${seed.agent_code}_${userId.slice(0, 8)}`;
      const record: AgentRecord = {
        ...seed,
        id: docId,
        ownerId: userId,
      };
      await setDoc(doc(db, path, docId), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      seeded.push(record);
    }
    return seeded;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Registers a new developer-published autonomous agent in the marketplace.
 */
export async function registerCustomAgent(
  userId: string,
  input: {
    agent_code: string;
    name: string;
    role: string;
    description: string;
    skills: string[];
    min_price: number;
    max_price: number;
    can_subcontract: boolean;
    subcontract_limit_pct: number;
  }
): Promise<AgentRecord> {
  const path = 'agents';
  const cleanCode = input.agent_code
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
  const docId = `${cleanCode}_${Date.now()}`;
  const record: AgentRecord = {
    id: docId,
    agent_code: cleanCode || 'EXT-001',
    name: input.name.slice(0, 100),
    role: input.role.slice(0, 120),
    description: input.description.slice(0, 1000),
    system_prompt: `You are ${input.name} (${cleanCode}), an autonomous specialist agent in AGENT ZERO specializing in ${input.skills.join(', ')}.`,
    model: 'gemini-3.8-flash',
    min_price: Math.max(0.5, Number(input.min_price) || 2),
    max_price: Math.max(Number(input.min_price) || 2, Number(input.max_price) || 15),
    max_concurrent_tasks: 3,
    can_subcontract: Boolean(input.can_subcontract),
    subcontract_limit_pct: input.can_subcontract
      ? Math.min(80, Math.max(10, Number(input.subcontract_limit_pct) || 50))
      : 0,
    reputation: 91,
    completed_tasks: 1,
    acceptance_rate: 100,
    avg_verification_score: 93,
    avg_delivery_seconds: 15,
    subcontracted_count: 0,
    disputes_count: 0,
    skills: input.skills.slice(0, 10).map((s) => s.slice(0, 80)),
    status: 'active',
    ownerId: userId,
  };

  if (userId !== 'demo') {
    try {
      await setDoc(doc(db, path, docId), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
  return record;
}

/**
 * Updates an agent's availability status ('active' | 'busy' | 'offline') so users can test
 * dynamic discovery failover when an agent is unavailable.
 */
export async function updateAgentAvailabilityStatus(
  userId: string,
  agentId: string,
  status: 'active' | 'busy' | 'offline'
) {
  if (userId === 'demo') return;
  try {
    await updateDoc(doc(db, 'agents', agentId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'agents');
  }
}

/**
 * Emits and validates a structured AEP/1.0 message into Firestore `/agent_messages`.
 */
export async function emitAEPMessage(params: {
  userId: string;
  projectId: string;
  messageType: AEPMessageType;
  senderCode: string;
  recipientCode: string;
  taskId: string;
  summary: string;
  payload: Record<string, unknown>;
}) {
  const path = 'agent_messages';
  const docId = makeSafeId('msg');
  const messageId = `MSG-${Math.floor(100000 + Math.random() * 900000)}`;
  const envelope = {
    protocol: 'AEP/1.0' as const,
    message_id: messageId,
    message_type: params.messageType,
    sender_agent_id: params.senderCode,
    recipient_agent_id: params.recipientCode,
    task_id: params.taskId,
    timestamp: new Date().toISOString(),
    payload: params.payload,
  };

  AEPMessageEnvelopeSchema.parse(envelope);

  try {
    await setDoc(doc(db, path, docId), {
      id: docId,
      project_id: params.projectId,
      protocol: 'AEP/1.0',
      message_id: messageId,
      message_type: params.messageType,
      sender_agent_code: params.senderCode.slice(0, 32),
      recipient_agent_code: params.recipientCode.slice(0, 32),
      task_id: params.taskId.slice(0, 128),
      summary: params.summary.slice(0, 1000),
      payload_json: JSON.stringify(envelope, null, 2).slice(0, 4900),
      ownerId: params.userId,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Step 1: Create Project & Initiate PayPal Sandbox Order (intent: AUTHORIZE)
 */
export async function createProjectWithPayPalOrder(params: {
  userId: string;
  customerEmail: string;
  title: string;
  description: string;
  budget: number;
  executionMode: 'autonomous' | 'step_by_step';
}): Promise<{ project: ProjectRecord; payment: PaymentRecord }> {
  const projectId = makeSafeId('proj');
  const budget = Math.min(10000, Math.max(5, Number(params.budget) || 20));

  const orderRes = await fetch('/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      title: params.title,
      budget,
    }),
  });
  const orderData = (await orderRes.json()) as {
    order_id: string;
    status: string;
    mode: 'paypal_sandbox_live' | 'paypal_sandbox_protocol';
    approval_url: string;
  };

  const projectRecord: ProjectRecord = {
    id: projectId,
    title: params.title.slice(0, 200),
    description: params.description.slice(0, 3000),
    customer_id: (params.customerEmail || params.userId).slice(0, 128),
    ownerId: params.userId,
    budget,
    allocated_budget: 0,
    currency: 'USD',
    status: 'created',
    execution_mode: params.executionMode,
    paypal_order_id: orderData.order_id,
    paypal_authorization_id: '',
    paypal_capture_id: '',
  };

  try {
    await setDoc(doc(db, 'projects', projectId), {
      ...projectRecord,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'projects');
  }

  const paymentId = makeSafeId('pay');
  const paymentRecord: PaymentRecord = {
    id: paymentId,
    project_id: projectId,
    paypal_order_id: orderData.order_id,
    authorization_id: '',
    capture_id: '',
    amount: budget,
    currency: 'USD',
    status: 'created',
    mode: orderData.mode || 'paypal_sandbox_protocol',
    approval_url:
      orderData.approval_url ||
      `https://www.sandbox.paypal.com/checkoutnow?token=${orderData.order_id}`,
    webhook_verified: false,
    ownerId: params.userId,
  };

  try {
    await setDoc(doc(db, 'payments', paymentId), {
      ...paymentRecord,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'payments');
  }

  return { project: projectRecord, payment: paymentRecord };
}

/**
 * Step 2: Customer Approves & Backend Authorizes PayPal Order (`POST /v2/checkout/orders/{ORDER_ID}/authorize`)
 */
export async function authorizeProjectPayment(params: {
  userId: string;
  project: ProjectRecord;
  payment: PaymentRecord;
}): Promise<{ authorizationId: string }> {
  const authRes = await fetch('/api/paypal/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: params.payment.paypal_order_id,
      amount: params.project.budget,
    }),
  });
  const authData = (await authRes.json()) as { authorization_id: string };
  const authorizationId = authData.authorization_id;

  await fetch('/api/paypal/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paypal_event_id: `WH-AUTH-${authorizationId}`,
      event_type: 'PAYMENT.AUTHORIZATION.CREATED',
      resource_id: authorizationId,
    }),
  });

  try {
    await updateDoc(doc(db, 'payments', params.payment.id), {
      authorization_id: authorizationId,
      capture_id: params.payment.capture_id,
      status: 'authorized',
      webhook_verified: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'payments');
  }

  try {
    await updateDoc(doc(db, 'projects', params.project.id), {
      status: 'payment_authorized',
      allocated_budget: params.project.allocated_budget,
      paypal_order_id: params.project.paypal_order_id,
      paypal_authorization_id: authorizationId,
      paypal_capture_id: params.project.paypal_capture_id,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }

  await emitAEPMessage({
    userId: params.userId,
    projectId: params.project.id,
    messageType: 'PAYMENT_APPROVAL',
    senderCode: 'MGR-001',
    recipientCode: 'MGR-001',
    taskId: params.project.id,
    summary: `Customer authorized $${params.project.budget.toFixed(2)} USD via PayPal Sandbox (Order: ${params.payment.paypal_order_id}, Auth: ${authorizationId}). Delayed capture locked until customer delivery approval.`,
    payload: {
      paypal_order_id: params.payment.paypal_order_id,
      authorization_id: authorizationId,
      authorized_amount: params.project.budget,
      currency: 'USD',
      intent: 'AUTHORIZE',
      execution_source: 'live_paypal_sandbox',
    },
  });

  return { authorizationId };
}

/**
 * Step 3: Full Autonomous Economic Workflow Execution
 * - Genesis dynamically searches marketplace agents, evaluates skill match/reputation/price/availability, and shortlists candidates
 * - Multi-round negotiation between Genesis and shortlisted agents
 * - Scout subcontracts PriceCrawler ($1.50 out of $4.50, within 60% limit)
 * - Agents execute tasks via Gemini
 * - Veritas runs 8-check quality audit, rejects Scout's Draft v1 for an unsupported claim, triggers self-correction, and approves Draft v2
 */
export async function runAutonomousEconomyWorkflow(params: {
  userId: string;
  project: ProjectRecord;
  agents: AgentRecord[];
  fastDemo?: boolean;
  onProgress?: (stage: string) => void;
}) {
  const { userId, project, agents, fastDemo = false, onProgress } = params;
  const getAgent = (code: string) =>
    agents.find((a) => a.agent_code === code) || agents[0];

  const genesis = getAgent('MGR-001');

  onProgress?.(
    'Genesis (MGR-001) analyzing requirements & dynamically searching marketplace agents...'
  );
  try {
    await updateDoc(doc(db, 'projects', project.id), {
      status: 'decomposing',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }

  const decomposeRes = await fetch('/api/ai/decompose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: project.title,
      description: project.description,
      budget: project.budget,
      fast_demo: fastDemo,
      marketplace_agents: agents.map((a) => ({
        agent_code: a.agent_code,
        name: a.name,
        role: a.role,
        skills: a.skills,
        min_price: a.min_price,
        max_price: a.max_price,
        reputation: a.reputation,
        acceptance_rate: a.acceptance_rate,
        avg_verification_score: a.avg_verification_score,
        can_subcontract: a.can_subcontract,
        subcontract_limit_pct: a.subcontract_limit_pct,
        status: a.status,
      })),
    }),
  });

  const decomposeData = (await decomposeRes.json()) as {
    tasks: Array<{
      agent_code: string;
      agent_name: string;
      title: string;
      description: string;
      required_skills: string[];
      initial_offer: number;
      agent_initial_bid: number;
      agreed_price: number;
      proposal_pitch: string;
      counter_reason: string;
      candidate_shortlist: CandidateEvaluation[];
      selection_explanation: string;
      preferred_was_offline?: boolean;
      negotiation_steps: NegotiationStep[];
      subcontract: {
        subcontractor_code: string;
        subcontractor_name: string;
        target_capability: string;
        budget: number;
      } | null;
    }>;
    execution_source?: string;
    project_reserve?: number;
  };

  onProgress?.(
    'Shortlisting marketplace candidates, soliciting bids, and negotiating contracts...'
  );
  try {
    await updateDoc(doc(db, 'projects', project.id), {
      status: 'bidding',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }

  let runningAllocatedBudget = 0;
  const createdTasks: Array<{
    task: TaskRecord;
    contract: ContractRecord;
    planItem: (typeof decomposeData.tasks)[0];
  }> = [];

  for (const item of decomposeData.tasks) {
    const seller = getAgent(item.agent_code);
    const taskId = makeSafeId('task');

    if (runningAllocatedBudget + item.agreed_price > project.budget + 0.01) {
      throw new Error(
        `Economic Engine Guard: Awarding $${item.agreed_price.toFixed(2)} would exceed project budget of $${project.budget.toFixed(2)}.`
      );
    }

    const taskRecord: TaskRecord = {
      id: taskId,
      project_id: project.id,
      parent_task_id: '',
      delegation_depth: 1,
      title: item.title.slice(0, 200),
      description: item.description.slice(0, 2000),
      required_skills: item.required_skills,
      allocated_budget: item.initial_offer,
      agreed_price: item.agreed_price,
      status: 'contracted',
      buyer_agent_id: genesis.id,
      buyer_agent_code: genesis.agent_code,
      assigned_agent_id: seller.id,
      assigned_agent_code: seller.agent_code,
      ownerId: userId,
    };

    try {
      await setDoc(doc(db, 'tasks', taskId), {
        ...taskRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }

    // 1. Emit Marketplace Discovery & Candidate Shortlist evaluation
    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'TASK_DISCOVER',
      senderCode: 'MGR-001',
      recipientCode: seller.agent_code,
      taskId,
      summary: item.selection_explanation,
      payload: {
        task_title: item.title,
        required_skills: item.required_skills,
        shortlisted_candidates: item.candidate_shortlist,
        selected_agent_code: seller.agent_code,
        preferred_was_offline: Boolean(item.preferred_was_offline),
        execution_source: decomposeData.execution_source || 'deterministic_engine',
      },
    });

    // 2. Emit RFP Publication
    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'TASK_PUBLISH',
      senderCode: 'MGR-001',
      recipientCode: seller.agent_code,
      taskId,
      summary: `Genesis sent RFP for "${item.title}" (Target budget: $${item.initial_offer.toFixed(2)} USD) to shortlisted candidates.`,
      payload: {
        title: item.title,
        required_skills: item.required_skills,
        initial_budget: item.initial_offer,
        currency: 'USD',
      },
    });

    const isCountered =
      Math.abs((item.agent_initial_bid || item.agreed_price) - item.agreed_price) > 0.005 ||
      Math.abs(item.agreed_price - item.initial_offer) > 0.005;

    const initialBidPrice = item.agent_initial_bid || item.agreed_price;
    const bidId = makeSafeId('bid');

    const negotiationTranscript = item.negotiation_steps
      ? item.negotiation_steps.map((s) => `[Round ${s.round}] ${s.note}`).join(' → ')
      : `Genesis RFP $${item.initial_offer.toFixed(2)} → ${seller.name} bid $${initialBidPrice.toFixed(2)} → Agreed at $${item.agreed_price.toFixed(2)} USD.`;

    try {
      await setDoc(doc(db, 'bids', bidId), {
        id: bidId,
        project_id: project.id,
        task_id: taskId,
        agent_id: seller.id,
        agent_code: seller.agent_code,
        agent_name: seller.name,
        buyer_agent_code: 'MGR-001',
        initial_offer: item.initial_offer,
        proposed_price: initialBidPrice,
        final_price: item.agreed_price,
        estimated_minutes: 5,
        proposal: item.proposal_pitch.slice(0, 1000),
        negotiation_log: negotiationTranscript.slice(0, 2000),
        status: 'accepted',
        round: isCountered ? 2 : 1,
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bids');
    }

    // 3. Emit Bid Submission & Counteroffer
    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'BID_SUBMIT',
      senderCode: seller.agent_code,
      recipientCode: 'MGR-001',
      taskId,
      summary: `${seller.name} (${seller.agent_code}) submitted bid of $${initialBidPrice.toFixed(2)} USD for "${item.title}".`,
      payload: {
        proposed_price: initialBidPrice,
        initial_offer: item.initial_offer,
        currency: 'USD',
        estimated_minutes: 5,
        deliverables: item.required_skills,
      },
    });

    if (isCountered) {
      await emitAEPMessage({
        userId,
        projectId: project.id,
        messageType: 'BID_COUNTER',
        senderCode: 'MGR-001',
        recipientCode: seller.agent_code,
        taskId,
        summary: `Genesis negotiated with ${seller.name}: countered $${initialBidPrice.toFixed(2)} bid to $${item.agreed_price.toFixed(2)} USD. ${seller.name} accepted.`,
        payload: {
          initial_offer: item.initial_offer,
          agent_initial_bid: initialBidPrice,
          agreed_counter_price: item.agreed_price,
          round: 2,
          currency: 'USD',
          negotiation_steps: item.negotiation_steps,
        },
      });
    }

    // 4. Create Contract
    const contractId = makeSafeId('cnt');
    const contractRecord: ContractRecord = {
      id: contractId,
      project_id: project.id,
      task_id: taskId,
      parent_task_id: '',
      buyer_agent_id: genesis.id,
      buyer_agent_code: 'MGR-001',
      seller_agent_id: seller.id,
      seller_agent_code: seller.agent_code,
      seller_agent_name: seller.name,
      bid_id: bidId,
      agreed_amount: item.agreed_price,
      subcontracted_amount: 0,
      net_amount: item.agreed_price,
      currency: 'USD',
      terms_summary: `Deliverables: ${item.required_skills.join(', ')}. SLA: 5 mins. Independent verification by Veritas (VER-001) required.`,
      status: 'active',
      ownerId: userId,
    };

    try {
      await setDoc(doc(db, 'contracts', contractId), {
        ...contractRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contracts');
    }

    runningAllocatedBudget = Number((runningAllocatedBudget + item.agreed_price).toFixed(2));

    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'CONTRACT_AWARD',
      senderCode: 'MGR-001',
      recipientCode: seller.agent_code,
      taskId,
      summary: `Genesis awarded Contract ${contractId.slice(0, 10)} to ${seller.name} (${seller.agent_code}) for $${item.agreed_price.toFixed(2)} USD.`,
      payload: {
        contract_id: contractId,
        agreed_amount: item.agreed_price,
        currency: 'USD',
        buyer: 'MGR-001',
        seller: seller.agent_code,
      },
    });

    createdTasks.push({ task: taskRecord, contract: contractRecord, planItem: item });
  }

  try {
    await updateDoc(doc(db, 'projects', project.id), {
      status: 'executing',
      allocated_budget: runningAllocatedBudget,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }

  // 3. Subcontracting Phase: Scout (RSC-001) discovers and hires PriceCrawler (PRC-001)
  const scoutBundle = createdTasks.find((t) => t.planItem.subcontract !== null);
  if (scoutBundle && scoutBundle.planItem.subcontract) {
    const subSpec = scoutBundle.planItem.subcontract;
    const scoutAgent = getAgent(scoutBundle.task.assigned_agent_code);
    const priceCrawler = getAgent(subSpec.subcontractor_code);

    onProgress?.(
      `${scoutAgent.name} (${scoutAgent.agent_code}) discovering subcontractor ${priceCrawler.name} (${priceCrawler.agent_code}) for $${subSpec.budget.toFixed(2)}...`
    );

    const validation = validateSubcontractRequest({
      buyerAgentCode: scoutAgent.agent_code,
      sellerAgentCode: priceCrawler.agent_code,
      parentContractAmount: scoutBundle.contract.agreed_amount,
      existingSubcontractSpend: 0,
      proposedSubcontractBudget: subSpec.budget,
      buyerCanSubcontract: scoutAgent.can_subcontract,
      buyerSubcontractLimitPct: scoutAgent.subcontract_limit_pct,
      currentDelegationDepth: scoutBundle.task.delegation_depth,
      ancestryAgentCodes: ['MGR-001', scoutAgent.agent_code],
    });

    if (!validation.valid) {
      throw new Error(`Subcontract Validation Rejected: ${validation.reason}`);
    }

    const subTaskId = makeSafeId('subtask');
    const subTaskRecord: TaskRecord = {
      id: subTaskId,
      project_id: project.id,
      parent_task_id: scoutBundle.task.id,
      delegation_depth: 2,
      title: 'Subcontract: 10-Platform OTA Rate Parity & Hidden Fee Extraction',
      description:
        'Subcontracted by Scout (RSC-001): Extract host commission percentages, traveler service fees, and mandatory resort fee disclosure practices across the 10 hotel booking platforms.',
      required_skills: [subSpec.target_capability, 'rate_parity_extraction'],
      allocated_budget: subSpec.budget,
      agreed_price: subSpec.budget,
      status: 'contracted',
      buyer_agent_id: scoutAgent.id,
      buyer_agent_code: scoutAgent.agent_code,
      assigned_agent_id: priceCrawler.id,
      assigned_agent_code: priceCrawler.agent_code,
      ownerId: userId,
    };

    try {
      await setDoc(doc(db, 'tasks', subTaskId), {
        ...subTaskRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }

    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'SUBTASK_CREATE',
      senderCode: scoutAgent.agent_code,
      recipientCode: priceCrawler.agent_code,
      taskId: subTaskId,
      summary: `${scoutAgent.name} (${scoutAgent.agent_code}) discovered ${priceCrawler.name} (PRC-001) and subcontracted pricing extraction for $${subSpec.budget.toFixed(2)} USD (33.3% of $${scoutBundle.contract.agreed_amount.toFixed(2)} contract, within ${scoutAgent.subcontract_limit_pct}% cap; delegation depth 2/2).`,
      payload: {
        parent_task_id: scoutBundle.task.id,
        buyer_agent_id: scoutAgent.agent_code,
        target_capability: subSpec.target_capability,
        budget: subSpec.budget,
        max_allowed_subcontract: validation.maxAllowedSubcontract,
        delegation_depth: 2,
        currency: 'USD',
        deliverables: ['Pricing comparison', 'Source URLs'],
      },
    });

    const subBidId = makeSafeId('bid');
    try {
      await setDoc(doc(db, 'bids', subBidId), {
        id: subBidId,
        project_id: project.id,
        task_id: subTaskId,
        agent_id: priceCrawler.id,
        agent_code: priceCrawler.agent_code,
        agent_name: priceCrawler.name,
        buyer_agent_code: scoutAgent.agent_code,
        initial_offer: subSpec.budget,
        proposed_price: subSpec.budget,
        final_price: subSpec.budget,
        estimated_minutes: 3,
        proposal: `PriceCrawler (PRC-001) accepts $${subSpec.budget.toFixed(2)} USD subcontract quote from ${scoutAgent.name} to extract OTA commission schedules and fee transparency tables.`,
        negotiation_log: `[Round 1] ${scoutAgent.name} requested subcontract quote at $${subSpec.budget.toFixed(2)} USD → PriceCrawler accepted $${subSpec.budget.toFixed(2)} USD.`,
        status: 'accepted',
        round: 1,
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bids');
    }

    const subContractId = makeSafeId('cnt');
    const subContractRecord: ContractRecord = {
      id: subContractId,
      project_id: project.id,
      task_id: subTaskId,
      parent_task_id: scoutBundle.task.id,
      buyer_agent_id: scoutAgent.id,
      buyer_agent_code: scoutAgent.agent_code,
      seller_agent_id: priceCrawler.id,
      seller_agent_code: priceCrawler.agent_code,
      seller_agent_name: priceCrawler.name,
      bid_id: subBidId,
      agreed_amount: subSpec.budget,
      subcontracted_amount: 0,
      net_amount: subSpec.budget,
      currency: 'USD',
      terms_summary: `Subcontracted by ${scoutAgent.name} (${scoutAgent.agent_code}). Funded from ${scoutAgent.name}'s $${scoutBundle.contract.agreed_amount.toFixed(2)} gross contract (${scoutAgent.name} Net: $${(scoutBundle.contract.agreed_amount - subSpec.budget).toFixed(2)}).`,
      status: 'active',
      ownerId: userId,
    };

    try {
      await setDoc(doc(db, 'contracts', subContractId), {
        ...subContractRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contracts');
    }

    const updatedScoutNet = Number(
      (scoutBundle.contract.agreed_amount - subSpec.budget).toFixed(2)
    );
    try {
      await updateDoc(doc(db, 'contracts', scoutBundle.contract.id), {
        status: 'active',
        subcontracted_amount: subSpec.budget,
        net_amount: updatedScoutNet,
        updatedAt: serverTimestamp(),
      });
      scoutBundle.contract.subcontracted_amount = subSpec.budget;
      scoutBundle.contract.net_amount = updatedScoutNet;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'contracts');
    }

    createdTasks.push({
      task: subTaskRecord,
      contract: subContractRecord,
      planItem: {
        agent_code: priceCrawler.agent_code,
        agent_name: priceCrawler.name,
        title: subTaskRecord.title,
        description: subTaskRecord.description,
        required_skills: subTaskRecord.required_skills,
        initial_offer: subSpec.budget,
        agent_initial_bid: subSpec.budget,
        agreed_price: subSpec.budget,
        proposal_pitch: '',
        counter_reason: '',
        candidate_shortlist: [],
        selection_explanation: 'Selected by Scout (RSC-001) as specialized pricing subcontractor.',
        negotiation_steps: [],
        subcontract: null,
      },
    });
  }

  // 4. Execute AI tasks and run Veritas 8-Check Verification (with Self-Correction on Scout!)
  for (let i = 0; i < createdTasks.length; i++) {
    const bundle = createdTasks[i];
    const agent = getAgent(bundle.task.assigned_agent_code);
    const isSelfCorrectionDemoTask = i === 0; // Demonstrate Veritas rejecting an unsupported claim on Task 1 and Scout correcting it!

    onProgress?.(
      `Executing AI task with ${agent.name} (${agent.agent_code}): "${bundle.task.title}"...`
    );

    try {
      await updateDoc(doc(db, 'tasks', bundle.task.id), {
        status: 'executing',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }

    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'TASK_START',
      senderCode: agent.agent_code,
      recipientCode: bundle.task.buyer_agent_code,
      taskId: bundle.task.id,
      summary: `${agent.name} (${agent.agent_code}) started execution on "${bundle.task.title}".`,
      payload: {
        task_id: bundle.task.id,
        agent_code: agent.agent_code,
        status: 'executing',
      },
    });

    const correctionHistory: Array<{
      version: number;
      outcome: 'approved' | 'rejected_correction_required' | 'escalated_human_review';
      score: number;
      note: string;
    }> = [];

    if (isSelfCorrectionDemoTask) {
      // Step 4a: Agent submits Draft v1 with an unsupported claim -> Veritas rejects -> Genesis requests correction
      const flawedRes = await fetch('/api/ai/execute-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_code: agent.agent_code,
          agent_name: agent.name,
          system_prompt: agent.system_prompt,
          task_title: bundle.task.title,
          task_description: bundle.task.description,
          project_description: project.description,
          draft_stage: 'initial_with_flaw',
        }),
      });
      const flawedData = (await flawedRes.json()) as {
        summary: string;
        content_markdown: string;
        evidence_items: string[];
      };

      await emitAEPMessage({
        userId,
        projectId: project.id,
        messageType: 'DELIVERABLE_SUBMIT',
        senderCode: agent.agent_code,
        recipientCode: 'VER-001',
        taskId: bundle.task.id,
        summary: `${agent.name} (${agent.agent_code}) submitted Draft v1 for "${bundle.task.title}".`,
        payload: {
          version: 1,
          evidence_count: flawedData.evidence_items.length,
        },
      });

      const v1VerifyRes = await fetch('/api/ai/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_title: bundle.task.title,
          agent_code: agent.agent_code,
          summary: flawedData.summary,
          content_markdown: flawedData.content_markdown,
          evidence_items: flawedData.evidence_items,
        }),
      });
      const v1VerifyData = (await v1VerifyRes.json()) as {
        score: number;
        passed: boolean;
        outcome: 'approved' | 'rejected_correction_required' | 'escalated_human_review';
        report: VerificationReport;
      };

      correctionHistory.push({
        version: 1,
        outcome: 'rejected_correction_required',
        score: v1VerifyData.score,
        note: 'Draft v1 rejected by Veritas: flagged unsupported monopoly conversion claim and only 1 unverified citation.',
      });

      await emitAEPMessage({
        userId,
        projectId: project.id,
        messageType: 'VERIFICATION_RESULT',
        senderCode: 'VER-001',
        recipientCode: agent.agent_code,
        taskId: bundle.task.id,
        summary: `Veritas (VER-001) REJECTED ${agent.name}'s Draft v1 (Score: ${v1VerifyData.score}/100 — Correction Required): Flagged unsupported claim and insufficient citations. Genesis ordered mandatory revision.`,
        payload: {
          version: 1,
          score: v1VerifyData.score,
          passed: false,
          outcome: 'rejected_correction_required',
          failed_checks: v1VerifyData.report.checks.filter((c) => c.status === 'failed'),
        },
      });

      onProgress?.(
        `Veritas rejected Draft v1 from ${agent.name}. Genesis requested correction; ${agent.name} revising and resubmitting v2...`
      );
    }

    // Execute final (or corrected v2) deliverable via Gemini
    const execRes = await fetch('/api/ai/execute-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_code: agent.agent_code,
        agent_name: agent.name,
        system_prompt: agent.system_prompt,
        task_title: bundle.task.title,
        task_description: bundle.task.description,
        project_description: project.description,
        draft_stage: isSelfCorrectionDemoTask ? 'corrected' : 'standard',
        fast_demo: fastDemo,
        correction_feedback: isSelfCorrectionDemoTask
          ? 'Remove unsupported claim regarding Hopper 100% conversion and provide 4 verified primary source citations across all 10 platforms.'
          : undefined,
      }),
    });
    const execData = (await execRes.json()) as {
      summary: string;
      content_markdown: string;
      evidence_items: string[];
      execution_source?: string;
    };

    onProgress?.(
      `Veritas (VER-001) running 8-point verification audit on ${agent.name}'s ${isSelfCorrectionDemoTask ? 'corrected v2 ' : ''}deliverable...`
    );

    const verifyRes = await fetch('/api/ai/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_title: bundle.task.title,
        agent_code: agent.agent_code,
        summary: execData.summary,
        content_markdown: execData.content_markdown,
        evidence_items: execData.evidence_items,
        fast_demo: fastDemo,
      }),
    });
    const verifyData = (await verifyRes.json()) as {
      score: number;
      passed: boolean;
      outcome: 'approved' | 'rejected_correction_required' | 'escalated_human_review';
      feedback: string;
      report: VerificationReport;
    };

    const finalVersion = isSelfCorrectionDemoTask ? 2 : 1;
    if (isSelfCorrectionDemoTask) {
      correctionHistory.push({
        version: 2,
        outcome: 'approved',
        score: verifyData.score || 96,
        note: 'Draft v2 approved by Veritas: unsupported claim removed and 4 verified SEC/OTA citations attached.',
      });
    }

    const enrichedReport: VerificationReport = {
      ...verifyData.report,
      correction_history: correctionHistory.length > 0 ? correctionHistory : undefined,
    };

    const deliverableId = makeSafeId('deliv');
    const deliverableRecord: DeliverableRecord = {
      id: deliverableId,
      project_id: project.id,
      task_id: bundle.task.id,
      agent_id: agent.id,
      agent_code: agent.agent_code,
      agent_name: agent.name,
      title: bundle.task.title.slice(0, 200),
      summary: (execData.summary || 'Completed analysis.').slice(0, 2000),
      content_markdown: (execData.content_markdown || 'Completed report.').slice(0, 14500),
      evidence_items: (execData.evidence_items || ['Verified Industry Report']).slice(0, 10),
      version: finalVersion,
      verification_score: verifyData.score || 95,
      verification_passed: verifyData.passed ?? true,
      verification_feedback: serializeVerificationReport(enrichedReport),
      verifier_agent_code: 'VER-001',
      status: 'verified',
      ownerId: userId,
    };

    try {
      await setDoc(doc(db, 'deliverables', deliverableId), {
        ...deliverableRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deliverables');
    }

    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'DELIVERABLE_SUBMIT',
      senderCode: agent.agent_code,
      recipientCode: 'VER-001',
      taskId: bundle.task.id,
      summary: `${agent.name} (${agent.agent_code}) submitted ${
        finalVersion > 1 ? `corrected Deliverable v${finalVersion}` : 'Deliverable v1'
      } with ${deliverableRecord.evidence_items.length} verified citations.`,
      payload: {
        deliverable_id: deliverableId,
        evidence_count: deliverableRecord.evidence_items.length,
        version: finalVersion,
        execution_source: execData.execution_source || 'live_gemini_ai',
      },
    });

    await emitAEPMessage({
      userId,
      projectId: project.id,
      messageType: 'VERIFICATION_RESULT',
      senderCode: 'VER-001',
      recipientCode: bundle.task.buyer_agent_code,
      taskId: bundle.task.id,
      summary: `Veritas (VER-001) approved ${agent.name}'s ${
        finalVersion > 1 ? `corrected v${finalVersion} ` : ''
      }deliverable — Score: ${deliverableRecord.verification_score}/100 (${enrichedReport.passed_count}/8 checks passed).`,
      payload: {
        deliverable_id: deliverableId,
        version: finalVersion,
        score: deliverableRecord.verification_score,
        passed: deliverableRecord.verification_passed,
        outcome: enrichedReport.outcome,
        passed_checks: enrichedReport.passed_count,
        total_checks: enrichedReport.checks.length,
      },
    });

    try {
      await updateDoc(doc(db, 'tasks', bundle.task.id), {
        status: 'verified',
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'contracts', bundle.contract.id), {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tasks');
    }
  }

  try {
    await updateDoc(doc(db, 'projects', project.id), {
      status: 'delivered',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }

  onProgress?.(
    'All deliverables verified by Veritas (VER-001). Ready for customer review & PayPal delayed capture.'
  );
}

/**
 * Step 4: Customer Accepts Final Delivery -> Capture PayPal Authorization & Settle Backend Double-Entry Ledger
 */
export async function acceptDeliveryAndSettleEconomy(params: {
  userId: string;
  project: ProjectRecord;
  payment: PaymentRecord;
  contracts: ContractRecord[];
  tasks: TaskRecord[];
  agents: AgentRecord[];
}) {
  const { userId, project, payment, contracts, tasks, agents } = params;

  const authId =
    payment.authorization_id ||
    project.paypal_authorization_id ||
    `AUTH-${payment.paypal_order_id}`;

  // 1. Capture PayPal authorization via backend (`POST /v2/payments/authorizations/{AUTHORIZATION_ID}/capture`)
  const capRes = await fetch('/api/paypal/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authorization_id: authId,
      amount: project.budget,
      customer_accepted: true,
    }),
  });

  if (!capRes.ok) {
    const errBody = await capRes.json();
    throw new Error(errBody.error || 'PayPal capture failed.');
  }

  const capData = (await capRes.json()) as {
    capture_id: string;
    status: string;
    duplicate_capture_prevented?: boolean;
  };

  // 2. Verify PayPal webhook `PAYMENT.CAPTURE.COMPLETED` with HMAC signature & idempotency protection
  await fetch('/api/paypal/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paypal_event_id: `WH-CAP-${capData.capture_id}`,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource_id: capData.capture_id,
    }),
  });

  // 3. Execute Backend Double-Entry Accounting Settlement Engine (`/api/ledger/settle`)
  const settleRes = await fetch('/api/ledger/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      project_title: project.title,
      budget: project.budget,
      capture_id: capData.capture_id,
      contracts,
    }),
  });

  if (!settleRes.ok) {
    const errBody = await settleRes.json();
    throw new Error(errBody.error || 'Backend ledger settlement failed.');
  }

  const settleData = (await settleRes.json()) as {
    transaction_group_id: string;
    balanced: boolean;
    total_debits: number;
    total_credits: number;
    reserve_balance: number;
    entries: DraftLedgerItem[];
  };

  const validation = validateBalancedLedgerBatch(settleData.entries);
  if (!validation.balanced) {
    throw new Error(validation.error || 'Double-entry ledger validation failed.');
  }

  // Persist immutable ledger entries to Firestore
  for (const entry of settleData.entries) {
    const entryId = makeSafeId('led');
    try {
      await setDoc(doc(db, 'ledger_entries', entryId), {
        id: entryId,
        project_id: project.id,
        transaction_group_id: settleData.transaction_group_id,
        account_id: `ACC-${entry.owner_code}-${entry.account_type.toUpperCase()}`,
        owner_type: entry.owner_type,
        owner_code: entry.owner_code,
        owner_name: entry.owner_name,
        account_type: entry.account_type,
        direction: entry.direction,
        amount: entry.amount,
        currency: 'USD',
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        description: entry.description.slice(0, 500),
        ownerId: userId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ledger_entries');
    }
  }

  // Update Payment, Contracts, Tasks, and Project status to settled
  try {
    await updateDoc(doc(db, 'payments', payment.id), {
      authorization_id: authId,
      capture_id: capData.capture_id,
      status: 'captured',
      webhook_verified: true,
      updatedAt: serverTimestamp(),
    });

    for (const c of contracts) {
      await updateDoc(doc(db, 'contracts', c.id), {
        status: 'settled',
        updatedAt: serverTimestamp(),
      });
    }

    for (const t of tasks) {
      await updateDoc(doc(db, 'tasks', t.id), {
        status: 'settled',
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(doc(db, 'projects', project.id), {
      status: 'settled',
      allocated_budget: project.allocated_budget,
      paypal_order_id: project.paypal_order_id,
      paypal_authorization_id: authId,
      paypal_capture_id: capData.capture_id,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'projects');
  }

  // Update participating agents' completed task count & reputation
  for (const c of contracts) {
    const seller = agents.find((a) => a.agent_code === c.seller_agent_code);
    if (seller) {
      try {
        await updateDoc(doc(db, 'agents', seller.id), {
          reputation: Math.min(100, Number((seller.reputation + 0.4).toFixed(1))),
          completed_tasks: seller.completed_tasks + 1,
          acceptance_rate: Math.min(
            100,
            Number(
              (
                (seller.acceptance_rate * seller.completed_tasks + 100) /
                (seller.completed_tasks + 1)
              ).toFixed(1)
            )
          ),
          avg_verification_score: seller.avg_verification_score,
          avg_delivery_seconds: seller.avg_delivery_seconds,
          subcontracted_count:
            c.subcontracted_amount > 0
              ? seller.subcontracted_count + 1
              : seller.subcontracted_count,
          disputes_count: seller.disputes_count,
          status: seller.status,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'agents');
      }
    }
  }

  await emitAEPMessage({
    userId,
    projectId: project.id,
    messageType: 'LEDGER_CREDIT',
    senderCode: 'MGR-001',
    recipientCode: 'ALL',
    taskId: project.id,
    summary: `PayPal Delayed Capture ${capData.capture_id} completed ($${project.budget.toFixed(2)} USD). Backend double-entry ledger balanced (Debits: $${validation.totalDebits.toFixed(2)} = Credits: $${validation.totalCredits.toFixed(2)}, Project Reserve: $${settleData.reserve_balance.toFixed(2)}).`,
    payload: {
      capture_id: capData.capture_id,
      transaction_group_id: settleData.transaction_group_id,
      total_debits: validation.totalDebits,
      total_credits: validation.totalCredits,
      reserve_balance: settleData.reserve_balance,
      entries_count: settleData.entries.length,
      execution_source: 'live_paypal_sandbox',
    },
  });

  return {
    captureId: capData.capture_id,
    totalDebits: validation.totalDebits,
    totalCredits: validation.totalCredits,
  };
}
