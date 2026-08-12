import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import type { BrokerJob } from './types';

const FILE_NAME = 'broker-jobs.json';
const OPS_FILE_NAME = 'blob-ops.json';
const REMOTE_PATH = 'sixa/broker-jobs.json';
const REMOTE_JOB_PREFIX = 'sixa/jobs/';
// Long TTL so repeated reads within an instance hit memory instead of the
// blob API — Vercel Blob advanced operations are quota-billed (2K/month free).
const REMOTE_CACHE_TTL_MS = 2000;

// Coalesce remote writes: at most one snapshot + per-job-file write-set every
// 2 minutes, so even a busy instance issues only a handful of advanced ops.
const FLUSH_INTERVAL_MS = 120_000;

// ---- Vercel Blob advanced-operation budget (free tier: 2K/month) ----
// Every get/put/list/delete is quota-billed. Exhausting the quota SUSPENDS
// the store and blocks ALL reads and writes for the project. To make that
// outage class impossible in future builds:
//   1. every remote call must pass through chargeRemoteOp() below;
//   2. remote writes are coalesced (flushSharedNow), bounding the write rate;
//   3. once the budget is spent this instance degrades to local-only mode
//      instead of hammering the billing API.
// The counter is persisted to the instance-local .data dir so restarts of
// the same instance do not silently reset it.
const REMOTE_OP_BUDGET = Number(process.env.BLOB_OP_BUDGET ?? 1000);
let remoteOpsUsed = loadOpsUsed();
let budgetExhaustedAt = 0;

function opsFilePath(): string {
  return resolve(join(process.cwd(), '.data', OPS_FILE_NAME));
}

function loadOpsUsed(): number {
  try {
    if (!existsSync(opsFilePath())) return 0;
    const raw = readFileSync(opsFilePath(), 'utf8');
    return raw.trim() ? (JSON.parse(raw) as { used: number }).used ?? 0 : 0;
  } catch {
    return 0;
  }
}

function persistOpsUsed(): void {
  try {
    writeAtomic(opsFilePath(), JSON.stringify({ used: remoteOpsUsed, month: new Date().toISOString().slice(0, 7) }));
  } catch {
    // non-fatal
  }
}

function chargeRemoteOp(kind: 'get' | 'put' | 'list' | 'delete'): boolean {
  if (remoteOpsUsed >= REMOTE_OP_BUDGET) {
    if (!budgetExhaustedAt) {
      budgetExhaustedAt = Date.now();
      console.error(
        `[store] Vercel Blob advanced-operation budget exhausted (limit ${REMOTE_OP_BUDGET}); a '${kind}' was refused. ` +
          'Remote reads/writes are disabled for this instance — degrading to local-only mode. ' +
          'Usage resets at the monthly quota reset or on instance restart.'
      );
    }
    return false;
  }
  remoteOpsUsed += 1;
  if (remoteOpsUsed % 50 === 0) persistOpsUsed();
  return true;
}

// Statically scoped under the project root so Turbopack allows the fs calls.
const filePath = resolve(join(process.cwd(), '.data', FILE_NAME));

export function usesSharedStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isSharedStoreBroken(): boolean {
  return remoteLastFailedAt > 0 && Date.now() - remoteLastFailedAt < 60_000;
}

let writeChain: Promise<void> = Promise.resolve();
let persistenceWarned = false;

// ---- local file (single-instance fallback) ----

export function loadJobs(): BrokerJob[] {
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw) as { jobs?: BrokerJob[] };
    return Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch (error) {
    if (!persistenceWarned) {
      persistenceWarned = true;
      console.warn('Broker store: could not read jobs file:', error instanceof Error ? error.message : error);
    }
    return [];
  }
}

export function saveJobs(jobs: BrokerJob[]): Promise<void> {
  saveJobsLocal(jobs);
  return flushSharedNow([...jobs]);
}

export function saveJobsLocal(jobs: BrokerJob[]): void {
  const snapshot = JSON.stringify({ jobs }, null, 0);
  writeChain = writeChain
    .then(() => writeAtomic(filePath, snapshot))
    .catch((error) => {
      if (!persistenceWarned) {
        persistenceWarned = true;
        console.warn('Broker persistence: job writes disabled (read-only filesystem?):', error instanceof Error ? error.message : error);
      }
    });
}

async function writeAtomic(target: string, content: string): Promise<void> {
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, target);
}

// ---- shared store (Vercel Blob — visible to every serverless instance) ----

let remoteCache: { jobs: BrokerJob[]; at: number } | null = null;
let remoteInFlight: Promise<BrokerJob[]> | null = null;
let remoteWarned = false;
let remoteLastFailedAt = 0;

/**
 * Read a single job directly from its own private blob path.
 * This is the fastest and most reliable path for the resume endpoint —
 * it does NOT require listing all jobs, which means it works correctly
 * even on a cold lambda that has never seen any jobs.
 */
export async function loadSharedJob(jobId: string): Promise<BrokerJob | null> {
  if (!usesSharedStore() || isSharedStoreBroken() || !chargeRemoteOp('get')) return null;
  try {
    const path = `${REMOTE_JOB_PREFIX}${jobId}.json`;
    const res = await blobGet(path, { access: 'private' });
    if (res && res.statusCode === 200 && res.stream) {
      const text = await new Response(res.stream).text();
      const parsed = JSON.parse(text) as BrokerJob;
      if (parsed && parsed.id === jobId) return parsed;
    }
  } catch (error) {
    remoteLastFailedAt = Date.now();
    if (!remoteWarned) {
      remoteWarned = true;
      console.warn('[store] loadSharedJob failed:', error instanceof Error ? error.message : error);
    }
  }
  return null;
}

async function readRemote(forceFresh = false): Promise<BrokerJob[]> {
  if (!forceFresh && remoteInFlight) return remoteInFlight;
  const doFetch = async (): Promise<BrokerJob[]> => {
    try {
      return await fetchNewestSnapshot();
    } catch (error) {
      remoteLastFailedAt = Date.now();
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: could not read shared blob (will retry on next call):', error instanceof Error ? error.message : error);
      }
      return [];
    } finally {
      remoteInFlight = null;
    }
  };
  const fetchPromise = doFetch();
  if (!forceFresh) remoteInFlight = fetchPromise;
  return fetchPromise;
}

let migrationTried = false;

async function fetchNewestSnapshot(): Promise<BrokerJob[]> {
  let missing = false;
  if (!chargeRemoteOp('get')) return [];
  try {
    const res = await blobGet(REMOTE_PATH, { access: 'private' });
    if (res && res.statusCode === 200 && res.stream) {
      const text = await new Response(res.stream).text();
      const parsed = JSON.parse(text) as { jobs?: BrokerJob[] };
      remoteLastFailedAt = 0;
      if (Array.isArray(parsed.jobs)) return parsed.jobs;
    }
  } catch (error) {
    const { BlobNotFoundError } = await import('@vercel/blob');
    if (error instanceof BlobNotFoundError) {
      missing = true;
    } else {
      // Auth/network failures (e.g. suspended store) must NOT trigger the
      // legacy list() migration — listing is quota-billed too.
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('[store] stable path read failed:', error instanceof Error ? error.message : error);
      }
      return [];
    }
  }

  // One-time legacy migration, only when the stable path is genuinely
  // missing. Lists snapshots at most once per serverless instance.
  if (missing && !migrationTried && chargeRemoteOp('list')) {
    migrationTried = true;
    try {
      const { list: blobList } = await import('@vercel/blob');
      const listing = await blobList({ prefix: 'sixa/snapshots/' });
      const sorted = listing.blobs.map((b) => b.pathname).sort();
      if (sorted.length > 0) {
        const res = await blobGet(sorted[sorted.length - 1], { access: 'private' });
        if (res && res.statusCode === 200 && res.stream) {
          const text = await new Response(res.stream).text();
          const parsed = JSON.parse(text) as { jobs?: BrokerJob[] };
          if (Array.isArray(parsed.jobs)) {
            putSnapshot(parsed.jobs).catch((e) => console.warn('[store] migration write failed:', e));
            remoteLastFailedAt = 0;
            return parsed.jobs;
          }
        }
      }
    } catch (migrateError) {
      console.warn('[store] migration fallback failed:', migrateError);
    }
  }

  return [];
}

export async function loadSharedJobs(forceFresh = false): Promise<BrokerJob[]> {
  if (!forceFresh && remoteCache && Date.now() - remoteCache.at < REMOTE_CACHE_TTL_MS) {
    return remoteCache.jobs;
  }
  const jobs = await readRemote(forceFresh);
  remoteCache = { jobs, at: Date.now() };
  return jobs;
}

async function putSnapshot(jobs: BrokerJob[]): Promise<void> {
  if (!chargeRemoteOp('put')) return;
  remoteCache = null;
  await blobPut(REMOTE_PATH, JSON.stringify({ jobs }, null, 0), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

/**
 * Write a single job to its own private blob path so it can be retrieved
 * directly by job ID on any serverless instance, including cold starts.
 */
async function putJobFile(job: BrokerJob): Promise<void> {
  if (!chargeRemoteOp('put')) return;
  const path = `${REMOTE_JOB_PREFIX}${job.id}.json`;
  await blobPut(path, JSON.stringify(job, null, 0), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

// ---- coalesced remote writes ----
// flushSharedNow never writes synchronously: it marks the dirty set and
// schedules ONE write-set (snapshot + per-job files for changed jobs) after
// FLUSH_INTERVAL_MS. This bounds advanced-op usage structurally no matter
// how often callers flush. `{ force: true }` writes immediately (creation).
const dirtyJobs = new Map<string, BrokerJob>();
let lastAllJobs: BrokerJob[] = [];
let flushScheduled = false;

export function flushSharedNow(jobs: BrokerJob[], options?: { force?: boolean }): Promise<void> {
  if (!usesSharedStore()) return Promise.resolve();
  if (options?.force) {
    return performFlush([...jobs], [...jobs]);
  }
  lastAllJobs = [...jobs];
  for (const job of jobs) {
    const prev = dirtyJobs.get(job.id);
    if (!prev || new Date(job.updatedAt) > new Date(prev.updatedAt)) {
      dirtyJobs.set(job.id, job);
    }
  }
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      const jobsToPut = [...dirtyJobs.values()];
      const allJobs = lastAllJobs;
      dirtyJobs.clear();
      if (jobsToPut.length > 0) void performFlush(allJobs, jobsToPut);
    }, FLUSH_INTERVAL_MS);
  }
  return Promise.resolve();
}

function performFlush(allJobs: BrokerJob[], changedJobs: BrokerJob[]): Promise<void> {
  if (allJobs.length === 0 && changedJobs.length === 0) return Promise.resolve();
  writeChain = writeChain
    .then(async () => {
      // Snapshot carries the full state; per-job files only for changed
      // jobs (the resume/cold-start path), so a busy instance stays cheap.
      await Promise.all([
        putSnapshot(allJobs),
        ...changedJobs.slice(0, 3).map((j) => putJobFile(j)),
      ]);
    })
    .catch((error) => {
      remoteLastFailedAt = Date.now();
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: shared blob write failed:', error instanceof Error ? error.message : error);
      }
    });
  return writeChain;
}