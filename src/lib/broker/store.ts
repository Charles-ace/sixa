import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import type { BrokerJob } from './types';

const FILE_NAME = 'broker-jobs.json';
const REMOTE_PATH = 'sixa/broker-jobs.json';
const REMOTE_JOB_PREFIX = 'sixa/jobs/';
// Long TTL so repeated reads within an instance hit memory instead of the
// blob API — Vercel Blob advanced operations are quota-billed (2K/month free).
const REMOTE_CACHE_TTL_MS = 30000;

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
  if (!usesSharedStore()) return null;
  try {
    const path = `${REMOTE_JOB_PREFIX}${jobId}.json`;
    const res = await blobGet(path, { access: 'private' });
    if (res && res.statusCode === 200 && res.stream) {
      const text = await new Response(res.stream).text();
      const parsed = JSON.parse(text) as BrokerJob;
      if (parsed && parsed.id === jobId) return parsed;
    }
  } catch (error) {
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
      try {
        return await fetchNewestSnapshot();
      } catch {
        // second attempt also failed
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
  if (missing && !migrationTried) {
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
  const path = `${REMOTE_JOB_PREFIX}${job.id}.json`;
  await blobPut(path, JSON.stringify(job, null, 0), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export function flushSharedNow(jobs: BrokerJob[]): Promise<void> {
  if (!usesSharedStore()) return Promise.resolve();
  writeChain = writeChain
    .then(async () => {
      // Write all-jobs snapshot AND individual job files in parallel
      await Promise.all([
        putSnapshot(jobs),
        ...jobs.map((j) => putJobFile(j)),
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