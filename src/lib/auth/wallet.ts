import { NextResponse } from 'next/server';
import type { Address } from 'viem';

import { signToken } from './token';

export const WALLET_COOKIE = 'sixa_wallet';
export const WALLET_MAX_AGE_DAYS = 7;

export const WALLET_MESSAGE_TITLE = 'Sixa guest sign-in';
export const WALLET_CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

export function buildWalletMessage(address: string, issuedAt: string): string {
  return `${WALLET_MESSAGE_TITLE}\nWallet: ${address.toLowerCase()}\nIssued at: ${issuedAt}`;
}

export function parseWalletMessage(message: string): { address: string; issuedAt: number } | null {
  const [title, walletLine, issuedLine] = message.split('\n');
  if (title !== WALLET_MESSAGE_TITLE) return null;
  const address = walletLine?.match(/^Wallet: (0x[0-9a-fA-F]{40})$/)?.[1];
  const issuedAtRaw = issuedLine?.match(/^Issued at: (.+)$/)?.[1];
  if (!address || !issuedAtRaw) return null;
  const issuedAt = Date.parse(issuedAtRaw);
  if (Number.isNaN(issuedAt)) return null;
  return { address: address.toLowerCase(), issuedAt };
}

export async function createWalletCookie(address: Address): Promise<NextResponse<unknown>> {
  const exp = Math.floor(Date.now() / 1000) + WALLET_MAX_AGE_DAYS * 24 * 60 * 60;
  const token = await signToken({ provider: 'wallet', address, exp, ts: Date.now() });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(WALLET_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WALLET_MAX_AGE_DAYS * 24 * 60 * 60,
  });
  return response;
}

export function clearWalletCookie(): NextResponse<unknown> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(WALLET_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}