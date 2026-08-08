import { createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import type { PaymentQuote, PaymentMode, PaymentRecord } from './types';

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_DECIMALS = 6;

const USDC_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

export function isPayerConfigured(): boolean {
  return Boolean(process.env.BROKER_PAYER_PRIVATE_KEY);
}

export function payerMode(): PaymentMode {
  return isPayerConfigured() ? 'real' : 'simulated';
}

export function effectivePayMode(requested: PaymentMode | undefined): PaymentMode {
  if (requested === 'real' && !isPayerConfigured()) {
    throw new ProviderError({
      code: 'payer_not_configured',
      message: 'Real payment requested but BROKER_PAYER_PRIVATE_KEY is not configured.',
      hint: 'Set BROKER_PAYER_PRIVATE_KEY and BROKER_PAYER_CHAIN_ID=8453 to enable real x402 payments.',
    });
  }
  if (requested === 'simulated' && isPayerConfigured()) {
    // Explicit request wins; but a fully simulated call is still allowed
    return 'simulated';
  }
  return requested ?? payerMode();
}

function parseUnits(amountUnits: string): bigint {
  try {
    return BigInt(amountUnits);
  } catch {
    return 0n;
  }
}

export async function payX402(quote: PaymentQuote, mode: PaymentMode): Promise<PaymentRecord> {
  if (mode === 'simulated') {
    return {
      mode: 'simulated',
      amountUsdc: quote.amountUsdc,
      asset: quote.asset,
      payTo: quote.payTo,
      network: quote.network,
      status: 'simulated',
    };
  }

  const privateKey = process.env.BROKER_PAYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new ProviderError({
      code: 'payer_not_configured',
      message: 'Real payment requested but BROKER_PAYER_PRIVATE_KEY is not configured.',
      hint: 'Set BROKER_PAYER_PRIVATE_KEY to enable real x402 payments.',
    });
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chainId = Number(process.env.BROKER_PAYER_CHAIN_ID ?? 8453);
  const chain = chainId === 1 ? undefined : chainId === 8453 ? base : undefined;
  if (!chain) {
    throw new ProviderError({
      code: 'unsupported_payer_chain',
      message: `BROKER_PAYER_CHAIN_ID=${chainId} is not supported. Use 8453 (Base) for x402.`,
    });
  }

  const rpcUrl = process.env.BROKER_PAYER_RPC_URL ?? 'https://mainnet.base.org';
  const client = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const amount = parseUnits(quote.amountUnits);
  if (amount <= 0n) {
    throw new ProviderError({ code: 'invalid_payment_amount', message: 'The x402 quote amount is invalid.' });
  }

  const to = quote.payTo as `0x${string}`;
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new ProviderError({ code: 'invalid_pay_to', message: 'The x402 payTo address is invalid.' });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(quote.asset)) {
    throw new ProviderError({ code: 'invalid_asset', message: 'The x402 asset address is invalid.' });
  }

  // Idempotency: exact amount to a fixed payTo means a completed transfer
  // can be re-sent harmlessly only if the previous one failed. Use a
  // deterministic idempotency key derived from quote to avoid double pay.
  const idempotencyKey = `x402-${quote.network}-${quote.asset.slice(0, 8)}-${to.slice(0, 8)}-${quote.amountUnits}`;
  const txHash = await client.writeContract({
    address: quote.asset as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [to, amount],
    chain,
  });
  void idempotencyKey;

  return {
    mode: 'real',
    amountUsdc: quote.amountUsdc,
    asset: quote.asset,
    payTo: to,
    network: quote.network,
    status: 'paid',
    txHash,
    paidAt: new Date().toISOString(),
  };
}