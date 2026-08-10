import { BrokerMcpClient } from './client';
import type { ExecutionResult } from './types';

export interface FallbackWorkflowRef {
  workflowId: string;
  name: string;
  buildPath: 'ai' | 'template' | 'none';
  workflowCreatedAt: string;
  execution: ExecutionResult | null;
}

export interface GeneratedWorkflowResult extends FallbackWorkflowRef {
  execution: ExecutionResult;
}

export interface GenerateOptions {
  maxPolls?: number;
  idempotencyKey?: string;
}

export async function createFallbackWorkflow(
  client: BrokerMcpClient,
  goal: string
): Promise<FallbackWorkflowRef> {
  try {
    const generated = await client.generateAndCreateWorkflow(goal);
    return {
      workflowId: generated.workflowId,
      name: generated.name,
      buildPath: 'ai',
      workflowCreatedAt: new Date().toISOString(),
      execution: null,
    };
  } catch (aiError) {
    // AI prompt disabled on this organization — deploy a matching
    // pre-built template instead so the agent still delivers a workflow.
    try {
      const templates = await client.searchWorkflowTemplates(goal, 5);
      if (templates.length === 0) {
        throw new Error('No reusable templates matched the goal');
      }
      const deployed = await client.deployWorkflowTemplate(templates[0].id);
      return {
        workflowId: deployed.workflowId,
        name: deployed.name,
        buildPath: 'template',
        workflowCreatedAt: new Date().toISOString(),
        execution: null,
      };
    } catch (templateError) {
      const aiMessage = aiError instanceof Error ? aiError.message : String(aiError);
      const tplMessage = templateError instanceof Error ? templateError.message : String(templateError);
      return {
        workflowId: '',
        name: '',
        buildPath: 'none',
        workflowCreatedAt: '',
        execution: {
          executionId: null,
          status: 'failed',
          output: null,
          completed: false,
          failed: true,
          error: `Workflow generation failed (AI: ${aiMessage}; template fallback: ${tplMessage}).`,
          verified: false,
          receipts: [],
        },
      };
    }
  }
}

export async function executeFallbackWorkflow(
  client: BrokerMcpClient,
  workflowId: string,
  params: Record<string, unknown>,
  opts?: GenerateOptions
): Promise<ExecutionResult> {
  try {
    const executed = await client.executeOrgWorkflow(workflowId, params, { idempotencyKey: opts?.idempotencyKey });
    if (!executed.executionId) {
      return {
        executionId: null,
        status: 'failed',
        output: null,
        completed: false,
        failed: true,
        error: 'The generated workflow did not return an execution id.',
        verified: false,
        receipts: [],
      };
    }
    const poll = await client.waitForExecution(executed.executionId, opts?.maxPolls ?? 20);
    if (!poll.completed || poll.status === 'timeout') {
      const timedOut = poll.status === 'timeout';
      return {
        executionId: executed.executionId,
        status: timedOut ? 'timeout' : poll.status,
        output: null,
        completed: false,
        failed: !timedOut ? poll.failed : false,
        error: timedOut
          ? 'The workflow was launched, but KeeperHub did not confirm completion within the polling window — confirm it in the KeeperHub dashboard.'
          : (poll.error ?? 'The workflow was launched, but its execution failed.'),
        verified: false,
        receipts: [],
        executionTxHash: poll.transactionHash ?? executed.transactionHash ?? null,
      };
    }
    return {
      executionId: executed.executionId,
      status: poll.status,
      output: null,
      completed: poll.completed,
      failed: poll.failed,
      error: poll.error,
      verified: poll.completed,
      receipts: [],
      executionTxHash: poll.transactionHash ?? executed.transactionHash ?? null,
    };
  } catch (error) {
    return {
      executionId: null,
      status: 'failed',
      output: null,
      completed: false,
      failed: true,
      error: error instanceof Error ? error.message : 'Generated workflow execution failed.',
      verified: false,
      receipts: [],
    };
  }
}

export async function generateAndRun(
  client: BrokerMcpClient,
  goal: string,
  params: Record<string, unknown>,
  opts?: GenerateOptions
): Promise<GeneratedWorkflowResult> {
  const ref = await createFallbackWorkflow(client, goal);
  if (ref.buildPath === 'none' && ref.execution) {
    return { ...ref, execution: ref.execution };
  }
  const execution = await executeFallbackWorkflow(client, ref.workflowId, params, opts);
  return {
    workflowId: ref.workflowId,
    name: ref.name,
    buildPath: ref.buildPath,
    workflowCreatedAt: ref.workflowCreatedAt,
    execution,
  };
}
