import { signToken, verifyToken, sha256Hex } from '@/lib/auth/token';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export const API_KEY_PREFIX = 'sk_live_';
export const API_KEY_TTL_SECONDS = 365 * 24 * 60 * 60;

export interface ApiKeyPayload {
  v: 1;
  kid: string;
  sub: string;
  name: string;
  accountAddress: string;
  accountEmail: string;
  iat: number;
  exp: number;
}

export interface ApiKeyRecord {
  kid: string;
  name: string;
  created: string;
  expiresAt: string;
  revoked: boolean;
}

const STORAGE_DIR = process.env.NODE_ENV === 'production' ? '/tmp/sixa_keys' : join(process.cwd(), '.sixa_keys');
const KEYS_FILE = join(STORAGE_DIR, 'issued_keys.json');
const REVOKED_FILE = join(STORAGE_DIR, 'revoked_keys.json');

function ensureStorageDir() {
  try {
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch {}
}

function loadRevokedKeys(): Set<string> {
  ensureStorageDir();
  try {
    if (existsSync(REVOKED_FILE)) {
      const data = JSON.parse(readFileSync(REVOKED_FILE, 'utf-8'));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch {}
  return new Set();
}

function saveRevokedKeys(set: Set<string>) {
  ensureStorageDir();
  try {
    writeFileSync(REVOKED_FILE, JSON.stringify(Array.from(set)), 'utf-8');
  } catch {}
}

function loadIssuedKeys(): Map<string, ApiKeyRecord[]> {
  ensureStorageDir();
  const map = new Map<string, ApiKeyRecord[]>();
  try {
    if (existsSync(KEYS_FILE)) {
      const obj = JSON.parse(readFileSync(KEYS_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) map.set(k, v as ApiKeyRecord[]);
      }
    }
  } catch {}
  return map;
}

function saveIssuedKeys(map: Map<string, ApiKeyRecord[]>) {
  ensureStorageDir();
  try {
    const obj: Record<string, ApiKeyRecord[]> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    writeFileSync(KEYS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {}
}

const revokedKeys = loadRevokedKeys();
const issuedByAccount = loadIssuedKeys();

export async function issueApiKey(input: {
  sub: string;
  name: string;
  accountAddress: string;
  accountEmail: string;
}): Promise<{ raw: string; record: ApiKeyRecord }> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + API_KEY_TTL_SECONDS;
  const kid = `k_${(await sha256Hex(`${input.sub}:${input.name}:${iat}`)).slice(0, 16)}`;

  const token = await signToken({
    v: 1,
    kid,
    sub: input.sub,
    name: input.name,
    accountAddress: input.accountAddress,
    accountEmail: input.accountEmail,
    iat,
    exp,
  } satisfies ApiKeyPayload);

  const record: ApiKeyRecord = {
    kid,
    name: input.name,
    created: new Date(iat * 1000).toISOString(),
    expiresAt: new Date(exp * 1000).toISOString(),
    revoked: false,
  };

  const existing = issuedByAccount.get(input.sub) ?? [];
  existing.push(record);
  issuedByAccount.set(input.sub, existing);
  saveIssuedKeys(issuedByAccount);

  return { raw: `${API_KEY_PREFIX}${token}`, record };
}

export async function readApiKey(raw: string): Promise<ApiKeyPayload | null> {
  if (!raw.startsWith(API_KEY_PREFIX)) return null;
  const token = raw.slice(API_KEY_PREFIX.length);
  const payload = await verifyToken<ApiKeyPayload>(token);
  if (!payload || payload.v !== 1 || !payload.kid || !payload.sub) return null;
  if (revokedKeys.has(payload.kid)) return null;
  return payload;
}

export function revokeApiKey(sub: string, kid: string): boolean {
  const records = issuedByAccount.get(sub);
  if (!records) return false;
  const record = records.find((r) => r.kid === kid);
  if (!record) return false;
  record.revoked = true;
  revokedKeys.add(kid);
  saveRevokedKeys(revokedKeys);
  saveIssuedKeys(issuedByAccount);
  return true;
}

export function listApiKeys(sub: string): ApiKeyRecord[] {
  return (issuedByAccount.get(sub) ?? []).slice().reverse();
}