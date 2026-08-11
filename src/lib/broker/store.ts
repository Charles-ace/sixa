import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import type { BrokerJob } from './types';

const FILE_NAME = 'broker-jobs.json';
const REMOTE_PATH = 'sixa/broker-jobs.json';
const REMOTE_CACHE_TTL_MS = 5000;

// Statically scoped under the project root so Turbopack allows the fs calls.
const filePath = resolve(join(process.cwd(), '.data', FILE_NAME));

// The shared store stays enabled for the instance lifetime; blob failures are
// transient and retried per call. A permanent latch made a lambda pool serve
// empty results forever (jobs/audit 404 divergence).
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
  // Save locally first
  saveJobsLocal(jobs);
  // Flush to shared store (Vercel Blob)
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

async function readRemote(forceFresh = false): Promise<BrokerJob[]> {
  if (!forceFresh && remoteInFlight) return remoteInFlight;
  const doFetch = async (): Promise<BrokerJob[]> => {
    try {
      return await fetchNewestSnapshot();
    } catch (error) {
      // Transient blob failure: record it for observability but DO NOT latch.
      remoteLastFailedAt = Date.now();
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: could not read shared blob (will retry on next call):', error instanceof Error ? error.message : error);
      }
      try {
        return await fetchNewestSnapshot();
      } catch {
        // second attempt also failed — still not latched, next call retries
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

/**
 * Reads directly from private stable blob object (sixa/broker-jobs.json).
 * Keeps data private and avoids expensive list() operations.
 */
async function fetchNewestSnapshot(): Promise<BrokerJob[]> {
  try {
    const res = await blobGet(REMOTE_PATH, { access: 'private' });
    if (res && res.statusCode === 200 && res.stream) {
      const text = await new Response(res.stream).text();
      const parsed = JSON.parse(text) as { jobs?: BrokerJob[] };
      remoteLastFailedAt = 0;
      if (Array.isArray(parsed.jobs)) return parsed.jobs;
    }
  } catch (error) {
    remoteLastFailedAt = Date.now();
    throw error;
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
  remoteCache = null;
  await blobPut(REMOTE_PATH, JSON.stringify({ jobs }, null, 0), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export function flushSharedNow(jobs: BrokerJob[]): Promise<void> {
  if (!usesSharedStore()) return Promise.resolve();
  writeChain = writeChain
    .then(() => putSnapshot(jobs))
    .catch((error) => {
      remoteLastFailedAt = Date.now();
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: shared blob write failed (will retry on next write):', error instanceof Error ? error.message : error);
      }
    });
  return writeChain;
}