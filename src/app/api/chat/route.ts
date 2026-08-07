import { NextRequest, NextResponse } from 'next/server';
import { chat, LLMError } from '@/lib/llm';
import { parseIntent, isExecutable } from '@/lib/intent-parser';
import { SIXA_SYSTEM_PROMPT, buildIntentExplanation, buildClarification } from '@/lib/chat-explainer';
import { simulateForChat, getConfigStatus } from '@/lib/keeperhub';
import { generateWorkflow } from '@/lib/workflows/agent';
import { getWorkflowProvider } from '@/lib/workflows/provider';
import { isTelegramConfigured, verifyTelegramConnection } from '@/lib/workflows/telegram';

const WORKFLOW_WORDS = /(workflow|automation|strategy|monitor|watch|track|alert|notify|rebalance|schedule|every (day|week|month|hour|minute)|when .* (drop|fall|rise|reach|below|above))/i;

function isWorkflowRequest(message: string): boolean {
  return WORKFLOW_WORDS.test(message) && !/send\s+\d+\s+(usdc|usdt|eth)/i.test(message);
}

async function handleWorkflowRoute(message: string, history: unknown[], walletAddress: string | undefined) {
  const config = getConfigStatus();

  if (/(list|show|display).*(workflows|automations|strategies)/i.test(message)) {
    const provider = getWorkflowProvider();
    const workflows = await provider.listWorkflows();
    const enabled = workflows.filter((w) => w.enabled);
    const content = workflows.length === 0
      ? 'No workflows on KeeperHub yet. Describe one ("watch my portfolio and alert me on Telegram if it drops 20%") and I will build it.'
      : `You have ${workflows.length} workflow${workflows.length === 1 ? '' : 's'} on KeeperHub (${enabled.length} enabled).\n\n${workflows
          .slice(0, 12)
          .map((w) => `• ${w.name}${w.enabled ? ' (active)' : ' (paused)'}`)
          .join('\n')}\n\nTell me which to pause, resume, or modify.`;
    return { content, workflowListing: workflows, keeperHub: config };
  }

  if (/(pause|stop|disable)\s+(.*)/i.test(message)) {
    const provider = getWorkflowProvider();
    const match = message.toLowerCase();
    const workflows = await provider.listWorkflows();
    const target = workflows.find((w) => match.includes(w.name.toLowerCase().split(' ')[0]) || match.includes(w.name.toLowerCase()));
    if (target) {
      await provider.setEnabled(target.id, false);
      return { content: `Paused workflow "${target.name}".`, workflowState: { id: target.id, enabled: false }, keeperHub: config };
    }
    return { content: 'Which workflow should I pause? Say "list workflows" to see them.', keeperHub: config };
  }

  if (/(resume|enable|start)\s+(.*)/i.test(message)) {
    const provider = getWorkflowProvider();
    const match = message.toLowerCase();
    const workflows = await provider.listWorkflows();
    const target = workflows.find((w) => match.includes(w.name.toLowerCase()));
    if (target) {
      await provider.setEnabled(target.id, true);
      return { content: `Resumed workflow "${target.name}".`, workflowState: { id: target.id, enabled: true }, keeperHub: config };
    }
    return { content: 'Which workflow should you resume? Say "workflows" to see them.', keeperHub: config };
  }

  const draft = await generateWorkflow(message, { walletAddress });
  const telegram = isTelegramConfigured()
    ? await verifyTelegramConnection().catch(() => ({ ok: false, error: 'Telegram check failed' }))
    : { ok: false, error: 'Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.' };

  const missing = draft.missingFields.length > 0 ? `\n\nI still need: ${draft.missingFields.join(', ')}` : '';
  const telegramNote = telegram.ok ? '' : `\n\n⚠ ${telegram.error ?? 'telegram not configured'}`;

  return {
    content: `I built this workflow for you:\n\n• ${draft.description}${missing}${telegramNote}\n\nSay "deploy it" to create it on KeeperHub, or "workflows" to see all of them.`,
    workflow: draft,
    telegram,
    keeperHub: config,
  };
}

async function handleDeploy(message: string, history: unknown[]) {
  const prior = (Array.isArray(history) ? history : [])
    .filter((m): m is Record<string, unknown> => Boolean(m) && typeof m === 'object')
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => String(m.content ?? ''))
    .join('\n');
  const contextText = `${prior}\n${message}`;
  const natural = contextText.replace(/deploy (it|this|the)/i, '').replace(/yes|go ahead|do it/i, '');
  const draft = await generateWorkflow(natural);
  const provider = getWorkflowProvider();
  const created = await provider.createWorkflow({
    name: draft.name,
    description: draft.description,
    nodes: draft.nodes,
    edges: draft.edges,
    enabled: false,
  });
  return {
    content: `Deployed "${created.name}" on KeeperHub (${created.id}). It is paused by default — say "resume ${created.name}" to activate it.`,
    workflow: draft,
    deployed: created,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], walletAddress, chainId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (isWorkflowRequest(message) || /deploy (it|this|the)/i.test(message)) {
      try {
        const result = /deploy (it|this|the)/i.test(message)
          ? await handleDeploy(message, history)
          : await handleWorkflowRoute(message, history, walletAddress);
        return NextResponse.json({ ...result, workflowIntent: true, executable: false });
      } catch (error) {
        console.error('Workflow route error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Workflow handling failed', code: 'workflow_failed', workflowIntent: true },
          { status: 500 }
        );
      }
    }

    const intent = parseIntent(message);

    if (intent.type === 'unknown') {
      return NextResponse.json({
        content: buildIntentExplanation(intent),
        intent,
        executable: false,
        simulation: null,
      });
    }

    const config = getConfigStatus();
    const simulation = isExecutable(intent) ? await simulateForChat(intent) : undefined;
    const fallbackExplanation = buildIntentExplanation(intent, simulation, Boolean(walletAddress));

    const contextLines = [
      `Wallet connected: ${walletAddress ? 'yes' : 'no'}`,
      walletAddress ? `Wallet: ${walletAddress}` : '',
      `Chain ID: ${chainId ?? 1}`,
      `Execution provider: ${config.provider} (${config.mode})`,
      `Protected execution: ${config.protectedExecution ? 'enabled' : 'disabled'}`,
      `Parsed intent: ${JSON.stringify(intent)}`,
      simulation ? `Simulation: ${JSON.stringify(simulation)}` : '',
    ].filter(Boolean).join('\n');

    let content = fallbackExplanation;
    try {
      const messages = [
        { role: 'system' as const, content: SIXA_SYSTEM_PROMPT },
        ...history
          .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
          .slice(-6)
          .map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: `USER REQUEST: ${message}\n\nCONTEXT:\n${contextLines}\n\nExplain the plan and confirm readiness.` },
      ];

      const response = await chat(messages, { temperature: 0.4, maxTokens: 600 });
      if (response.content && response.content.trim().length > 10) {
        content = response.content.trim();
      }
    } catch (error) {
      console.error('LLM fallback used:', error instanceof Error ? error.message : 'unknown');
    }

    const needsClarification = isExecutable(intent) && (
      (intent.type === 'swap' && !intent.params?.toToken) ||
      (intent.type === 'bridge' && !intent.params?.targetChain) ||
      (intent.type === 'send' && !intent.params?.address)
    );

    if (needsClarification) {
      return NextResponse.json({
        content: buildClarification(intent),
        intent,
        executable: false,
        simulation: null,
      });
    }

    return NextResponse.json({
      content,
      intent,
      executable: isExecutable(intent),
      simulation,
    });
  } catch (error) {
    if (error instanceof LLMError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
