import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { get as blobGet, put as blobPut } from '@vercel/blob';
import type { BrokerJob } from './types';

const FILE_NAME = 'broker-jobs.json';
const SAVE_DEBOUNCE_MS = 400;
const REMOTE_PATH = 'sixa/broker-jobs.json';
const REMOTE_SAVE_DEBOUNCE_MS = 800;
const REMOTE_CACHE_TTL_MS = 2500;

// Statically scoped under the project root so Turbopack allows the fs calls.
const filePath = resolve(join(process.cwd(), '.data', FILE_NAME));

export function usesSharedStore(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

let writeChain: Promise<void> = Promise.resolve();
let saveTimer: NodeJS.Timeout | null = null;
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

export function saveJobs(jobs: BrokerJob[]): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = JSON.stringify({ jobs }, null, 0);
    writeChain = writeChain
      .then(() => writeAtomic(filePath, snapshot))
      .catch((error) => {
        if (!persistenceWarned) {
          persistenceWarned = true;
          console.warn('Broker persistence: job writes disabled (read-only filesystem?):', error instanceof Error ? error.message : error);
        }
      });
    if (usesSharedStore()) {
      pushRemote(jobs);
    }
  }, SAVE_DEBOUNCE_MS);
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
let remoteSaveTimer: NodeJS.Timeout | null = null;
let remoteWarned = false;

async function readRemote(): Promise<BrokerJob[]> {
  if (remoteInFlight) return remoteInFlight;
  remoteInFlight = (async () => {
    try {
      const res = await blobGet(REMOTE_PATH, { access: 'public' });
      if (!res || res.statusCode !== 200 || !res.stream) return [];
      const text = await new Response(res.stream).text();
      const parsed = JSON.parse(text) as { jobs?: BrokerJob[] };
      return Array.isArray(parsed.jobs) ? parsed.jobs : [];
    } catch (error) {
      if (!remoteWarned) {
        remoteWarned = true;
        console.warn('Broker store: could not read shared blob:', error instanceof Error ? error.message : error);
      }
      return [];
    } finally {
      remoteInFlight = null;
    }
  })();
  return remoteInFlight;
}

export async function loadSharedJobs(): Promise<BrokerJob[]> {
  if (remoteCache && Date.now() - remoteCache.at < REMOTE_CACHE_TTL_MS) {
    return remoteCache.jobs;
  }
  const jobs = await readRemote();
  remoteCache = { jobs, at: Date.now() };
  return jobs;
}

function pushRemote(jobs: BrokerJob[]): void {
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(() => {
    writeChain = writeChain
      .then(async () => {
        await blobPut(REMOTE_PATH, JSON.stringify({ jobs }, null, 0), {
          access: 'public',
          addRandomSuffix: false,
          cacheControlMaxAge: 0,
        });
      })
      .catch((error) => {
        if (!remoteWarned) {
          remoteWarned = true;
          console.warn('Broker persistence: shared blob write failed:', error instanceof Error ? error.message : error);
        }
      });
  }, REMOTE_SAVE_DEBOUNCE_MS);
}