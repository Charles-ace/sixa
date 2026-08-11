import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const RESULTS_DIR = resolve(join(__dirname, '..', 'results'));
const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

async function verifyTx(runId: string, txHash: string | null, expectedFrom: string | null, expectedTo: string | null) {
  if (!txHash) {
    console.log(`Run ${runId}: no tx hash — nothing to verify on-chain`);
    return null;
  }
  const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  // KeeperHub executes native transfers through its vault contract; the
  // execution tx input encodes forward(runner, recipient, amountWei).
  let decoded: Record<string, unknown> | null = null;
  try {
    if (tx.input.startsWith('0x9aefaff8')) {
      const arg = (idx: number) => '0x' + tx.input.slice(10 + idx * 64, 10 + (idx + 1) * 64);
      decoded = {
        runner: arg(0).replace(/^0x0+/, '0x'),
        recipient: arg(1).replace(/^0x0+/, '0x'),
        amountWei: BigInt(arg(2)).toString(),
      };
    }
  } catch {}
  const amountMatches = decoded ? BigInt((decoded.amountWei as string) ?? '0') === 100000000000000n : null;
  const fromMatches = decoded
    ? (decoded.runner as string).toLowerCase() === (expectedFrom ?? '').toLowerCase()
    : !expectedFrom || tx.from.toLowerCase() === expectedFrom.toLowerCase();
  const toMatches = decoded
    ? (decoded.recipient as string).toLowerCase() === (expectedTo ?? '').toLowerCase()
    : !expectedTo || (tx.to ?? '').toLowerCase() === expectedTo.toLowerCase();
  const result = {
    runId,
    txHash,
    status: receipt.status,
    blockNumber: Number(receipt.blockNumber),
    confirmations: Number(block.number - receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
    txFrom: tx.from,
    txTo: tx.to,
    decoded,
    runnerMatches: fromMatches,
    recipientMatches: toMatches,
    amountMatches,
    verified: receipt.status === 'success' && fromMatches === true && toMatches === true && amountMatches === true,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const runs = process.argv.slice(2);
  const results: Record<string, unknown> = {};
  for (const runId of runs) {
    const file = join(RESULTS_DIR, `fallback-run-${runId}.json`);
    let trace: any;
    try {
      trace = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      console.log(`Run ${runId}: no trace file at ${file}`);
      continue;
    }
    const txHash = trace.terminal?.execution?.executionTxHash ?? trace.terminal?.execution?.transactionHash ?? null;
    results[runId] = await verifyTx(
      runId,
      txHash,
      '0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61',
      '0xa8ee74b6E4F84Df415112A004758675407659a94'
    );
  }
  writeFileSync(join(RESULTS_DIR, 'onchain-verification.json'), JSON.stringify(results, null, 2));
  console.log('Saved -> results/onchain-verification.json');
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e);
  process.exit(1);
});
