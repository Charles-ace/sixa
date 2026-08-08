import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage, type Address } from 'viem';

import { buildWalletMessage, createWalletCookie, parseWalletMessage, WALLET_CHALLENGE_WINDOW_MS } from '@/lib/auth/wallet';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const ipLimit = rateLimit(`auth-wallet:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.', code: 'rate_limited' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      address?: string;
      message?: string;
      signature?: string;
    };
    const address = typeof body.address === 'string' ? body.address.trim().toLowerCase() : '';
    const message = typeof body.message === 'string' ? body.message : '';
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';

    if (!/^0x[0-9a-f]{40}$/.test(address) || !message || !signature) {
      return NextResponse.json({ error: 'Missing wallet proof.', code: 'invalid_request' }, { status: 400 });
    }

    const parsed = parseWalletMessage(message);
    if (!parsed || parsed.address !== address) {
      return NextResponse.json({ error: 'Invalid sign-in message.', code: 'invalid_message' }, { status: 400 });
    }
    if (Date.now() - parsed.issuedAt > WALLET_CHALLENGE_WINDOW_MS || parsed.issuedAt > Date.now() + 60_000) {
      return NextResponse.json({ error: 'Sign-in message expired. Try again.', code: 'expired_message' }, { status: 400 });
    }

    const expectedMessage = buildWalletMessage(address, new Date(parsed.issuedAt).toISOString());
    const valid = await verifyMessage({
      address: address as Address,
      message: expectedMessage,
      signature: signature as Address,
    });
    if (!valid) {
      return NextResponse.json({ error: 'Signature does not match this wallet.', code: 'bad_signature' }, { status: 401 });
    }

    return await createWalletCookie(address as Address);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Guest sign-in failed.', code: 'wallet_failed' },
      { status: 500 }
    );
  }
}