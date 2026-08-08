export type JobStatus =
  | 'intake'
  | 'discovering'
  | 'selecting'
  | 'quoting'
  | 'paying'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed';

export type PaymentMode = 'simulated' | 'real';

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

export interface PaymentRecord {
  mode: PaymentMode;
  amountUsdc: number;
  asset: string;
  payTo: string;
  network: string;
  status: 'quoted' | 'paid' | 'simulated';
  txHash?: string;
  paidAt?: string;
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
  | 'job_failed';

export interface AuditEvent {
  id: string;
  jobId: string;
  type: AuditEventType;
  message: string;
  data: Record<string, unknown> | null;
  timestamp: string;
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
}

export interface BrokerModule {
  createJob(input: { message: string; accountEmail?: string | null; budgetUsdc?: number; forcedSlug?: string; payMode?: PaymentMode }): Promise<BrokerJob>;
  getJob(jobId: string): BrokerJob | null;
  listJobs(): BrokerJob[];
  getAudit(jobId: string): AuditEvent[];
  runJob(jobId: string): Promise<BrokerJob>;
}

export const MAX_JOB_AGE_MS = 60 * 60 * 1000;