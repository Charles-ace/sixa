import { BrokerMcpClient } from './client';
import type { ExecutionResult } from './types';

export interface GeneratedWorkflowResult {
  workflowId: string;
  name: string;
  buildPath: 'ai' | 'template' | 'none';
  workflowCreatedAt: string;
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
  let buildPath: 'ai' | 'template';
  let workflowCreatedAt = '';
  try {
    const generated = await client.generateAndCreateWorkflow(goal);
    workflowId = generated.workflowId;
    name = generated.name;
    buildPath = 'ai';
    workflowCreatedAt = new Date().toISOString();
  } catch (aiError) {
    // AI prompt disabled on this organization — deploy a matching
    // pre-built template instead so the agent still delivers a workflow.
    try {
      const templates = await client.searchWorkflowTemplates(goal, 5);
      if (templates.length === 0) {
        throw new Error('No reusable templates matched the goal');
      }
      const deployed = await client.deployWorkflowTemplate(templates[0].id);
      workflowId = deployed.workflowId;
      name = deployed.name;
      buildPath = 'template';
      workflowCreatedAt = new Date().toISOString();
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

  try {
    const executed = await client.executeOrgWorkflow(workflowId, params, { idempotencyKey: opts?.idempotencyKey });
    if (!executed.executionId) {
      throw new Error('The generated workflow did not return an execution id.');
    }
    const poll = await client.waitForExecution(executed.executionId, opts?.maxPolls ?? 3);
    if (executed.executionId && (!poll.completed || poll.status === 'timeout')) {
      return {
        workflowId,
        name,
        buildPath,
        workflowCreatedAt,
        execution: {
          executionId: executed.executionId,
          status: poll.status === 'timeout' ? 'timeout' : poll.status,
          output: null,
          completed: false,
          failed: false,
          error: 'The workflow was launched, but KeeperHub did not confirm completion within the polling window — confirm it in the KeeperHub dashboard.',
          verified: false,
          receipts: [],
          executionTxHash: poll.transactionHash ?? executed.transactionHash ?? null,
        },
      };
    }
    return {
      workflowId,
      name,
      buildPath,
      workflowCreatedAt,
      execution: {
        executionId: executed.executionId,
        status: poll.status,
        output: null,
        completed: poll.completed,
        failed: poll.failed,
        error: poll.error,
        verified: poll.completed,
        receipts: [],
        executionTxHash: poll.transactionHash ?? executed.transactionHash ?? null,
      },
    };
  } catch (error) {
    return {
      workflowId,
      name,
      buildPath,
      workflowCreatedAt,
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