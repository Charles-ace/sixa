import { BrokerMcpClient } from './client';
import type { ExecutionResult } from './types';

export async function verifyExecution(
  client: BrokerMcpClient,
  executionId: string,
  opts?: { maxPolls?: number }
): Promise<ExecutionResult> {
  const pollResult = await client.waitForExecution(executionId, opts?.maxPolls);

  if (pollResult.completed) {
    return {
      executionId,
      status: pollResult.status,
      output: null,
      completed: true,
      failed: false,
      error: null,
      verified: true,
      receipts: pollResult.transactionHashes ?? [],
      executionTxHash: pollResult.transactionHash ?? null,
    };
  }

  return {
    executionId,
    status: pollResult.status,
    output: null,
    completed: false,
    failed: true,
    error: pollResult.error ?? 'Execution did not complete in the polling window.',
    verified: false,
    receipts: pollResult.transactionHashes ?? [],
    executionTxHash: pollResult.transactionHash ?? null,
  };
}

export { verifyExecution as verify };
export const VERIFY_DURATION_MS_KEY = 'verifyDurationMs';
export function executionDurationMs(startedAt: number, finishedAt: number): number {
  return finishedAt - startedAt;
}