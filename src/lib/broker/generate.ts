import { BrokerMcpClient } from './client';
import type { ExecutionResult } from './types';

export interface GeneratedWorkflowResult {
  workflowId: string;
  name: string;
  execution: ExecutionResult;
}

export interface GenerateOptions {
  maxPolls?: number;
  idempotencyKey?: string;
}

export async function generateAndRun(
  client: BrokerMcpClient,
  goal: string,
  params: Record<string, unknown>,
  opts?: GenerateOptions
): Promise<GeneratedWorkflowResult> {
  let workflowId: string;
  let name: string;
  try {
    const generated = await client.generateAndCreateWorkflow(goal);
    workflowId = generated.workflowId;
    name = generated.name;
  } catch (error) {
    return {
      workflowId: '',
      name: '',
      execution: {
        executionId: null,
        status: 'failed',
        output: null,
        completed: false,
        failed: true,
        error: error instanceof Error ? error.message : 'Workflow generation failed.',
        verified: false,
        receipts: [],
      },
    };
  }

  try {
    const executed = await client.executeOrgWorkflow(workflowId, params, { idempotencyKey: opts?.idempotencyKey });
    if (!executed.executionId) {
      throw new Error('The generated workflow did not return an execution id.');
    }
    const poll = await client.waitForExecution(executed.executionId, opts?.maxPolls);
    return {
      workflowId,
      name,
      execution: {
        executionId: executed.executionId,
        status: poll.status,
        output: null,
        completed: poll.completed,
        failed: poll.failed,
        error: poll.error,
        verified: poll.completed,
        receipts: [],
      },
    };
  } catch (error) {
    return {
      workflowId,
      name,
      execution: {
        executionId: null,
        status: 'failed',
        output: null,
        completed: false,
        failed: true,
        error: error instanceof Error ? error.message : 'Generated workflow execution failed.',
        verified: false,
        receipts: [],
      },
    };
  }
}