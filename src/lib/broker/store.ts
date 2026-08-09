import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import type { BrokerJob } from './types';

const FILE_NAME = 'broker-jobs.json';
const REMOTE_PATH = 'sixa/broker-jobs.json';
const REMOTE_CACHE_TTL_MS = 2500;

// Statically scoped under the project root so Turbopack allows the fs calls.
const filePath = resolve(join(process.cwd(), '.data', FILE_NAME));

// Disabled permanently for this process the first time the shared store fails.
// A dead blob must never stall or poison reads (empty results) for the rest of
// the instance lifetime.
let sharedBroken = false;

export function usesSharedStore(): boolean {
  return !sharedBroken && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isSharedStoreBroken(): boolean {
  return sharedBroken;
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
  // No debounce: the instance can die at any moment (serverless freeze, Render
  // restarts, OOM). Every state transition must be on disk immediately.
  const snapshot = JSON.stringify({ jobs }, null, 0);
  writeChain = writeChain
    .then(() => writeAtomic(filePath, snapshot))
    .catch((error) => {
      if (!persistenceWarned) {
        persistenceWarned = true;
        console.warn('Broker persistence: job writes disabled (read-only filesystem?):', error instanceof Error ? error.message : error);
      }
    });
  // Blob writes are not debounced either: every state change must be durable
  // immediately so other instances can see it.
  return flushSharedNow([...jobs]);
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

async function readRemote(forceFresh = false): Promise<BrokerJob[]> {
  if (!forceFresh && remoteInFlight) return remoteInFlight;
  const doFetch = async (): Promise<BrokerJob[]> => {
    try {
      const res = await blobGet(REMOTE_PATH, { access: 'public' });
      if (!res || res.statusCode !== 200 || !res.stream) return [];
      const text = await new Response(res.stream).text();
      const parsed = JSON.parse(text) as { jobs?: BrokerJob[] };
      return Array.isArray(parsed.jobs) ? parsed.jobs : [];
    } catch (error) {
      sharedBroken = true;
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: could not read shared blob — shared store disabled for this instance:', error instanceof Error ? error.message : error);
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
    access: 'public',
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
      sharedBroken = true;
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: shared blob write failed — shared store disabled for this instance:', error instanceof Error ? error.message : error);
      }
    });
  return writeChain;
}