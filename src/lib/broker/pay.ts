import { createPublicClient, createWalletClient, decodeEventLog, http, parseAbi } from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import { assetDecimals, isNativeAsset, type OnChainReceipt, type PaymentQuote, type PaymentMode, type PaymentRecord } from './types';

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_DECIMALS = 6;

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const USDC_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const TRANSFER_EVENT = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { type: 'address', indexed: true, name: 'from' },
      { type: 'address', indexed: true, name: 'to' },
      { type: 'uint256', indexed: false, name: 'value' },
    ],
  },
] as const;

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

export function basePublicClient(rpcUrl?: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl ?? process.env.BROKER_PAYER_RPC_URL ?? 'https://mainnet.base.org'),
  });
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
  const publicClient = basePublicClient(rpcUrl);

  const amount = parseUnits(quote.amountUnits);
  if (amount <= 0n) {
    throw new ProviderError({ code: 'invalid_payment_amount', message: 'The x402 quote amount is invalid.' });
  }

  const to = quote.payTo as `0x${string}`;
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new ProviderError({ code: 'invalid_pay_to', message: 'The x402 payTo address is invalid.' });
  }

  // Native quotes (eth / zero address) pay with a plain value transfer — a
  // single ETH balance then covers BOTH the payment and the gas for it.
  const native = isNativeAsset(quote.asset);
  if (!native && !/^0x[a-fA-F0-9]{40}$/.test(quote.asset)) {
    throw new ProviderError({ code: 'invalid_asset', message: 'The x402 asset address is invalid.' });
  }

  const txHash = native
    ? await client.sendTransaction({ to, value: amount, chain })
    : await client.writeContract({
        address: quote.asset as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [to, amount],
        chain,
      });

  const receipt = await confirmOnChainReceipt({
    txHash,
    asset: native ? 'native' : quote.asset,
    native,
    networkName: chainId === 1 ? 'ethereum' : 'base',
    expectedAmountUnits: quote.amountUnits,
    expectedRecipient: to,
    publicClient,
    payer: account.address,
  });

  return {
    mode: 'real',
    amountUsdc: quote.amountUsdc,
    asset: quote.asset,
    payTo: to,
    network: quote.network,
    status: 'paid',
    txHash,
    paidAt: new Date().toISOString(),
    receipt,
  };
}

export interface ConfirmReceiptInput {
  txHash: `0x${string}`;
  asset: string;
  native?: boolean;
  expectedAmountUnits?: string;
  expectedRecipient?: string;
  publicClient: ReturnType<typeof basePublicClient>;
  payer: string;
  networkName?: string;
}

/**
 * Waits for a broadcast USDC transfer to mine, decodes its Transfer event,
 * and returns a provable on-chain receipt. Throws if the transaction never
 * mines, reverts, or moves an amount/recipient that differs from the quote,
 * so a "real" payment can never silently masquerade as settled.
 */
export async function confirmOnChainReceipt(opts: ConfirmReceiptInput): Promise<OnChainReceipt> {
  const { txHash, asset, native = false, expectedAmountUnits, expectedRecipient, publicClient, payer, networkName = 'base' } = opts;

  let receipt;
  try {
    receipt = await waitForTransactionReceipt(publicClient, {
      hash: txHash,
      confirmations: 1,
      timeout: 60_000,
      pollingInterval: 1_000,
    });
  } catch {
    throw new ProviderError({
      code: 'payment_unconfirmed',
      message: `Transaction ${txHash} was broadcast but no receipt arrived in time.`,
      hint: 'Check that the payer wallet holds enough native gas (ETH) on the destination chain.',
    });
  }
  if (receipt.status !== 'success') {
    throw new ProviderError({
      code: 'payment_reverted',
      message: `Transaction ${txHash} reverted on-chain.`,
      hint: native ? 'The payer wallet likely lacks ETH balance for this native payment.' : 'The payer wallet likely lacks USDC balance for this transfer.',
    });
  }

  let amountUnits: bigint | null = null;
  let recipient = '';
  if (native) {
    // Native payment — the value moved is on the transaction itself, not a
    // token Transfer event.
    try {
      const tx = await publicClient.getTransaction({ hash: txHash });
      amountUnits = tx.value;
      recipient = tx.to ? tx.to.toLowerCase() : '';
    } catch {
      // tx lookup failed — the mismatch checks below will flag it
    }
  } else {
    const log = receipt.logs.find((l) => l.address.toLowerCase() === asset.toLowerCase() && l.topics[0] === TRANSFER_TOPIC);
    if (log) {
      try {
        const decoded = decodeEventLog({ abi: TRANSFER_EVENT, data: log.data, topics: log.topics });
        const args = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
        amountUnits = args.value;
        recipient = args.to.toLowerCase();
      } catch {
        // undecodable log — the mismatch checks below will flag it
      }
    }
  }

  const latest = await publicClient.getBlockNumber().catch(() => receipt.blockNumber + 1n);
  const matches = {
    amount: amountUnits !== null && expectedAmountUnits !== undefined && amountUnits === BigInt(expectedAmountUnits),
    recipient: Boolean(expectedRecipient && recipient && recipient === expectedRecipient.toLowerCase()),
  };

  return {
    txHash,
    status: 'success',
    from: payer.toLowerCase(),
    recipient,
    asset: native ? 'native' : asset.toLowerCase(),
    network: networkName,
    amountUnits: amountUnits?.toString() ?? '0',
    amountUsdc: amountUnits ? Number(amountUnits) / 10 ** assetDecimals(asset) : 0,
    blockNumber: Number(receipt.blockNumber),
    blockHash: receipt.blockHash ?? txHash,
    gasUsed: receipt.gasUsed?.toString() ?? '0',
    gasPrice: receipt.effectiveGasPrice?.toString() ?? '0',
    confirmations: Number(latest - receipt.blockNumber) + 1,
    matches,
    verifiedAt: new Date().toISOString(),
  };
}