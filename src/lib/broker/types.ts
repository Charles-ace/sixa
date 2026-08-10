export type JobStatus =
  | 'intake'
  | 'discovering'
  | 'selecting'
  | 'quoting'
  | 'paying'
  | 'awaiting_payment'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed';

export type PaymentMode = 'simulated' | 'real' | 'user';

export interface JobSpec {
  goal: string;
  query: string;
  params: Record<string, unknown>;
  budgetUsdc: number;
  chainId: number | null;
  maxPriceUsdc: number | null;
}

export interface ListingCandidate {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceUsdcPerCall: number;
  inputSchema: Record<string, unknown> | null;
  workflowType: 'read' | 'write' | string;
  callCount: number;
  isListed: boolean;
  organizationId: string;
  category: string | null;
  chain: string | null;
  listedAt: string;
}

export interface ExAccepts {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string };
}

export interface PaymentQuote {
  x402Version: number;
  asset: string;
  network: string;
  amountUnits: string;
  amountUsdc: number;
  payTo: string;
  maxTimeoutSeconds: number;
  resourceUrl: string;
  description: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * x402 quotes quote either an ERC20 token (an address) or the chain's
 * native token ('native' or the zero address). Native quotes let a single
 * gas balance cover payment + gas.
 */
export function isNativeAsset(asset: string): boolean {
  const a = (asset ?? '').trim().toLowerCase();
  return a === 'native' || a === 'eth' || a === ZERO_ADDRESS;
}

export function assetDecimals(asset: string): number {
  return isNativeAsset(asset) ? 18 : 6;
}

export interface ReceiptCheck {
  amount: boolean;
  recipient: boolean;
  sender: boolean;
}

export interface OnChainReceipt {
  txHash: string;
  status: 'success' | 'reverted';
  from: string;
  recipient: string;
  asset: string;
  network: string;
  amountUnits: string;
  amountUsdc: number;
  blockNumber: number;
  blockHash: string;
  gasUsed: string;
  gasPrice: string;
  confirmations: number;
  matches: ReceiptCheck;
  verifiedAt: string;
}

export interface PaymentRecord {
  mode: PaymentMode;
  amountUsdc: number;
  asset: string;
  payTo: string;
  network: string;
  status: 'quoted' | 'paid' | 'simulated';
  txHash?: string;
  paidAt?: string;
  receipt?: OnChainReceipt | null;
}

export interface ExecutionResult {
  executionId: string | null;
  status: string;
  output: string | null;
  completed: boolean;
  failed: boolean;
  error: string | null;
  verified: boolean;
  receipts: string[];
  simulated?: boolean;
  /** Base tx hash of the actual on-chain action performed by the workflow. */
  executionTxHash?: string | null;
}

export interface CheckResultDetail {
  ok: boolean;
  how: string;
  detail: string | null;
}

/**
 * Verdict for a job that reached a terminal success state. A job is only
 * 'verified' when BOTH the x402 payment settlement and the on-chain
 * execution were independently confirmed. Anything missing/unconfirmed is
 * 'unverified' with the exact failing check named.
 */
export interface CompletionProof {
  status: 'verified' | 'unverified';
  payment_tx_hash: string | null;
  payment_confirmed: CheckResultDetail;
  execution_tx_hash: string | null;
  execution_confirmed: CheckResultDetail;
  workflow_id: string | null;
}

export type DecisionSource = 'marketplace_existing' | 'generated_fallback';

export interface CallRecord {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

/**
 * Explicit per-job decision record: which path was taken, the workflow it
 * resolved to, and the actual discover/generate calls sent to KeeperHub
 * with their responses. Written once per job, before execution starts.
 */
export interface JobDecision {
  source: DecisionSource;
  workflow_id: string;
  workflow_created_at: string;
  workflow_owner_address: string | null;
  discover_call: CallRecord;
  generate_call: CallRecord | null;
}

export type AuditEventType =
  | 'job_created'
  | 'intent_parsed'
  | 'catalog_searched'
  | 'candidate_found'
  | 'selection_made'
  | 'quote_received'
  | 'payment_made'
  | 'payment_simulated'
  | 'payment_verified'
  | 'payment_unverified'
  | 'payment_reverted'
  | 'execution_requested'
  | 'execution_polled'
  | 'execution_completed'
  | 'verification_passed'
  | 'verification_failed'
  | 'fallback_started'
  | 'fallback_generation'
  | 'fallback_executed'
  | 'candidate_failed'
  | 'job_completed'
  | 'job_failed'
  | 'path_decided'
  | 'completion_verified'
  | 'completion_unverified';

export interface AuditEvent {
  id: string;
  jobId: string;
  type: AuditEventType;
  message: string;
  data: Record<string, unknown> | null;
  timestamp: string;
}

export interface DecisionRecord {
  source: 'marketplace_existing' | 'generated_fallback';
  workflow_id: string;
  workflow_created_at: string;
  workflow_owner_address: string;
  discover_call: {
    request: { query: string; chainId: number | null };
    response: { candidateCount: number; candidates: Array<{ id: string; slug: string; name: string; listedAt: string; organizationId: string }> };
  };
  generate_call: {
    request: { goal: string };
    response: { workflowId: string; name: string; buildPath: string } | null;
  } | null;
}

export interface BrokerJob {
  id: string;
  status: JobStatus;
  spec: JobSpec;
  accountEmail: string | null;
  createdAt: string;
  updatedAt: string;
  candidates: ListingCandidate[];
  selected: ListingCandidate | null;
  quote: PaymentQuote | null;
  payment: PaymentRecord | null;
  execution: ExecutionResult | null;
  audit: AuditEvent[];
  report: string | null;
  error: string | null;
  forcedSlug: string | null;
  payMode: PaymentMode;
  decision: JobDecision | null;
  decisionRecord: DecisionRecord | null;
  proof: CompletionProof | null;
}

export interface BrokerModule {
  createJob(input: { message: string; accountEmail?: string | null; budgetUsdc?: number; forcedSlug?: string; payMode?: PaymentMode }): Promise<BrokerJob>;
  getJob(jobId: string): BrokerJob | null;
  listJobs(): BrokerJob[];
  getAudit(jobId: string): AuditEvent[];
  runJob(jobId: string): Promise<BrokerJob>;
}

export const MAX_JOB_AGE_MS = 60 * 60 * 1000;