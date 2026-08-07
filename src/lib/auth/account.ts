import { sha256Hex } from './token';

export interface SessionAccount {
  provider: 'email' | 'google';
  email: string;
  name?: string;
  picture?: string;
}

export const SESSION_COOKIE = 'sixa_session';
export const SESSION_MAX_AGE_DAYS = 30;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function resolveAccount(input: {
  provider: 'email' | 'google';
  email: string;
  name?: string;
  picture?: string;
}): Promise<SessionAccount> {
  const email = normalizeEmail(input.email);
  return {
    provider: input.provider,
    email,
    name: input.name,
    picture: input.picture,
  };
}

export async function accountId(account: SessionAccount): Promise<string> {
  return `acct_${(await sha256Hex(`${account.provider}:${account.email}`)).slice(0, 16)}`;
}

export async function deriveAccountAddress(account: SessionAccount): Promise<string> {
  const hash = await sha256Hex(`keeperhub:${account.email}:${account.provider}`);
  return `0x${hash.slice(0, 40)}`;
}