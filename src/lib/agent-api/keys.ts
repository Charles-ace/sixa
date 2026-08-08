import { signToken, verifyToken, sha256Hex } from '@/lib/auth/token';

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

const revokedKeys = new Set<string>();
const issuedByAccount = new Map<string, ApiKeyRecord[]>();

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
  return true;
}

export function listApiKeys(sub: string): ApiKeyRecord[] {
  return (issuedByAccount.get(sub) ?? []).slice().reverse();
}