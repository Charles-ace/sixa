import type { WorkflowDraft, WorkflowEdge, WorkflowNode, WorkflowTriggerType } from './types';
import { buildTriggerNode, buildActionNode, buildWorkflowEdge, autoLayout, templateRef } from './builder';
import { getWorkflowSchemas, getChainByNetwork } from './schemas';

export interface AgentContext {
  walletAddress?: string;
  chatId?: string;
}

const DAYS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};

function parseTrigger(text: string): { triggerType: WorkflowTriggerType; config: Record<string, unknown> } {
  const lower = text.toLowerCase();

  const minutes = lower.match(/every (\d+) minutes?/);
  if (minutes) return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: `*/${minutes[1]} * * * *` } };

  const hours = lower.match(/every (\d+) hours?/);
  if (hours) return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: `0 */${hours[1]} * * *` } };

  for (const day of Object.keys(DAYS)) {
    if (lower.includes(`every ${day}`) || lower.includes(`on ${day}s`)) {
      return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: `0 9 * * ${DAYS[day]}` } };
    }
  }
  if (/(daily|every day|each day)/.test(lower)) return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: '0 9 * * *' } };
  if (/(weekly|every week)/.test(lower)) return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: '0 9 * * 1' } };
  if (/(monthly|every month)/.test(lower)) return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: '0 9 1 * *' } };
  if (/(when i say|on demand|manually|just once|now)/.test(lower)) return { triggerType: 'Manual', config: { triggerType: 'Manual' } };
  if (/(notify|alert|monitor|watch|track|keep an eye)/.test(lower)) return { triggerType: 'Schedule', config: { triggerType: 'Schedule', scheduleCron: '*/15 * * * *' } };

  return { triggerType: 'Manual', config: { triggerType: 'Manual' } };
}

function extractAmount(text: string): string | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(%|USDT|USDC|ETH|WETH|DAI|USDT|wei|USDC)?/i);
  if (!match) return undefined;
  return match[1];
}

function extractPercent(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : undefined;
}

function extractToken(text: string): string | undefined {
  const match = text.match(/\b(ETH|WETH|USDC|USDT|DAI|WBTC|stETH|POL|AVAX)\b/i);
  return match ? match[1].toUpperCase() : undefined;
}

function extractAddress(text: string): string | undefined {
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  return match?.[0];
}

function extractNetwork(text: string): string | undefined {
  const map: Record<string, string> = {
    base: '8453', arbitrum: '42161', arb: '42161', ethereum: '1', eth: '1', mainnet: '1',
    optimism: '10', op: '10', polygon: '137', poly: '137', avalanche: '43114', avax: '43114', solana: '101',
  };
  const phrase = text.match(/(?:on|to|over|onto|via|chain)\s+(base|arbitrum|arb|ethereum|eth|mainnet|optimism|op|polygon|poly|avalanche|avax|solana)\b/i);
  if (phrase) return map[phrase[1].toLowerCase()];
  const match = text.match(/\b(base|arbitrum|ethereum|optimism|polygon|avalanche|solana)\b/i);
  return match ? map[match[1].toLowerCase()] : undefined;
}

function nodeId(index: number): string {
  return index === 0 ? 'trigger-1' : `step-${index}`;
}

function slugify(text: string): string {
  const clean = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return clean.slice(0, 48) || 'workflow';
}

function describeTrigger(cron: string): string {
  if (cron === '*/5 * * * *') return 'every 5 minutes';
  if (cron === '*/15 * * * *') return 'every 15 minutes';
  if (cron === '0 * * * *') return 'every hour';
  if (cron === '0 9 * * *') return 'daily at 9:00';
  if (cron === '0 9 * * 1') return 'weekly (Monday 9:00)';
  if (cron === '0 9 1 * *') return 'monthly (1st, 9:00)';
  const every = cron.match(/\*\/\d+/);
  if (every) return `every ${every[0].slice(2)} min`;
  return 'scheduled';
}

function buildSummary(draft: { triggerType: WorkflowTriggerType; triggerConfig: Record<string, unknown>; nodes: WorkflowNode[]; edges: WorkflowEdge[] }): WorkflowDraft['summary'] {
  const triggerLabel = draft.triggerType === 'Manual' ? 'Manual' : draft.triggerType === 'Schedule' ? `Schedule — ${describeTrigger(String(draft.triggerConfig.scheduleCron ?? ''))}` : draft.triggerType;
  const actions = draft.nodes
    .filter((n) => n.type === 'action')
    .map((n) => ({
      nodeId: n.id,
      label: n.data.label,
      actionType: String(n.data.config.actionType ?? n.data.label),
      config: n.data.config,
    }));
  return { trigger: { label: triggerLabel, config: draft.triggerConfig }, actions, edges: draft.edges };
}

function defaultNetwork(): string {
  return String(process.env.KEEPERHUB_CHAIN_ID ?? '8453');
}

function buildNotifyNode(chatId: string, message: string, index: number, channel: 'telegram' | 'discord' = 'telegram'): WorkflowNode {
  const actionType = channel === 'discord' ? 'discord/send-message' : 'telegram/send-message';
  return buildActionNode(
    nodeId(index),
    channel === 'discord' ? 'Notify Discord' : 'Notify Telegram',
    { actionType, chatId, message, channel },
    channel === 'discord'
      ? 'Sends a Discord message through the KeeperHub-connected Discord bot'
      : 'Sends a Telegram message through the KeeperHub-connected Telegram bot',
    { x: 0, y: 0 }
  );
}

function tokenConfigJson(token: string, network: string): string {
  const registry: Record<string, Record<string, string>> = {
    '8453': { USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', WETH: '0x4200000000000000000000000000000000000006', USDT: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
    '84532': { USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' },
    '1': { USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    '42161': { USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    '10': { USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  };
  const address = registry[network]?.[token];
  return JSON.stringify({ mode: 'custom', customToken: { address: address ?? '0x0000000000000000000000000000000000000000', symbol: token } });
}

function isMonitoringIntent(text: string): boolean {
  return /(watch|monitor|track|alert|notify|keep an eye|check if|when|if)/i.test(text);
}

function isTransferIntent(text: string): boolean {
  return /(send|pay|transfer|move|push|deposit)/i.test(text) && !/when|if/i.test(text);
}

function isConditionalIntent(text: string): boolean {
  return /(if|when)\s+([a-z0-9]+)\s+(drops?|falls?|rises?|goes|below|above|reaches?)/i.test(text);
}

function buildRuleDraft(text: string, ctx?: AgentContext): WorkflowDraft {
  const trigger = parseTrigger(text);
  const triggerType = trigger.triggerType;
  const triggerConfig = trigger.config;
  const nodes: WorkflowNode[] = [buildTriggerNode(triggerConfig)];
  const edges: WorkflowEdge[] = [];
  const missing: string[] = [];
  const network = extractNetwork(text) ?? defaultNetwork();
  const lower = text.toLowerCase();
  let workflowType: WorkflowDraft['workflowType'] = 'manual';
  let confidence = 0.5;
  let description = '';

  if (isTransferIntent(text)) {
    workflowType = 'transfer';
    confidence = 0.7;
    const amount = extractAmount(text);
    const token = extractToken(text) ?? 'ETH';
    const recipient = extractAddress(text) ?? ctx?.walletAddress;
    const label = token === 'ETH' ? 'Send Native Funds' : `Send ${token}`;
    const actionConfig: Record<string, unknown> = {
      actionType: token === 'ETH' ? 'web3/transfer-funds' : 'web3/transfer-token',
      network,
      amount: amount ?? '0',
      ...(token === 'ETH' ? {} : { tokenConfig: tokenConfigJson(token, network) }),
      ...(recipient ? { recipientAddress: recipient } : {}),
    };
    const step = buildActionNode(nodeId(1), label, actionConfig, 'Transfers funds through KeeperHub with smart gas and MEV protection', { x: 252, y: 0 });
    nodes.push(step);
    edges.push(buildWorkflowEdge('trigger-1', step.id));
    if (!amount) missing.push('amount');
    if (!recipient) missing.push('recipientAddress');
    description = `${token}${amount ? ` ${amount}` : ''} transferred to ${recipient ? recipient.slice(0, 10) + '…' : 'a recipient'} on chain ${network}`;
    if (triggerType === 'Schedule') description += `, triggered ${describeTrigger(String(triggerConfig.scheduleCron ?? ''))}`;
  } else if (isConditionalIntent(text) || isMonitoringIntent(text)) {
    workflowType = 'monitor';
    confidence = 0.8;
    const priceMatch = lower.match(/(if|when)\s+(\w+)\s+(drops?|falls?|rises?|goes)\s+(\d+(?:\.\d+)?)\s*%/);
    const triggerToken = priceMatch?.[2] ? priceMatch[2].toUpperCase() : extractToken(text) ?? 'ETH';
    const percent = priceMatch ? parseFloat(priceMatch[4]) : extractPercent(text);
    const belowMatch = lower.match(/below\s+([\d.,]+)\s*(usd|dollars?)?/);
    const monitorNodeLabel = triggerToken === 'ETH' ? 'Check Balance' : `Check ${triggerToken} Balance`;
    const isTokenMonitor = triggerToken !== 'ETH';
    const monitorConfig: Record<string, unknown> = {
      actionType: isTokenMonitor ? 'web3/check-token-balance' : 'web3/check-balance',
      network,
      ...(ctx?.walletAddress ? { address: ctx.walletAddress } : {}),
      ...(isTokenMonitor ? { tokenConfig: tokenConfigJson(triggerToken, network) } : {}),
    };
    const step1 = buildActionNode(nodeId(1), monitorNodeLabel, monitorConfig, 'Reads the current on-chain balance', { x: 252, y: 0 });
    nodes.push(step1);
    edges.push(buildWorkflowEdge('trigger-1', step1.id));
    if (!ctx?.walletAddress) missing.push('walletAddress');

    const balanceField = isTokenMonitor ? `${templateRef(step1.id, monitorNodeLabel, 'balance.balance')}` : templateRef(step1.id, monitorNodeLabel, 'balance');
    let conditionExpr: string | undefined;
    let conditionLabel = 'Condition';
    if (percent && priceMatch) {
      const op = /drops?|falls?/i.test(priceMatch[3]) ? '<=' : '>=';
      conditionExpr = `${balanceField} ${op} threshold`;
      conditionLabel = `${triggerToken} moved ${op === '<=' ? 'below' : 'above'} threshold`;
      missing.push('priceThresholdValue');
    } else if (belowMatch) {
      conditionExpr = `${balanceField} < ${belowMatch[1].replace(/,/g, '')}`;
      conditionLabel = `Balance below ${belowMatch[1]}`;
    } else if (percent) {
      conditionExpr = `${balanceField} < threshold`;
      missing.push('referenceValue');
    } else {
      conditionExpr = `${balanceField} exists`;
      conditionLabel = 'Balance present';
    }

    const step2 = buildActionNode(nodeId(2), conditionLabel, { actionType: 'Condition', condition: conditionExpr }, 'Routes true/false branches', { x: 504, y: 0 });
    nodes.push(step2);
    edges.push(buildWorkflowEdge(step1.id, step2.id));

    const msg = `Alert: ${triggerToken} condition met. Balance: ${balanceField}`;
    const wantsDiscord = /(discord|dc)/i.test(lower);
    const wantsTelegram = /(telegram|tg|notify|alert)/i.test(lower);
    const channels: Array<'telegram' | 'discord'> = [];
    if (wantsDiscord) channels.push('discord');
    if (wantsTelegram || channels.length === 0) channels.push('telegram');

    channels.forEach((channel, i) => {
      const step = buildNotifyNode('', msg, 3 + i, channel);
      nodes.push(step);
      edges.push(buildWorkflowEdge(step2.id, step.id, { sourceHandle: 'true' }));
    });

    description = `Monitors ${triggerToken} on chain ${network}${percent ? `, alerts when it moves ${percent}%` : ''}`;
    if (channels.length > 0) description += `, notifying via ${channels.join(' and ')}`;
    if (triggerType === 'Schedule') description += ` (check ${describeTrigger(String(triggerConfig.scheduleCron ?? ''))})`;
  } else {
    workflowType = 'manual';
    confidence = 0.4;
    description = 'Manual workflow — add an action node to define what should run.';
  }

  const withPositions = autoLayout(nodes);
  const name = slugify(text);

  return {
    name,
    description,
    workflowType,
    trigger: triggerType,
    triggerConfig,
    nodes: withPositions,
    edges,
    summary: buildSummary({ triggerType, triggerConfig, nodes: withPositions, edges }),
    missingFields: missing,
    confidence,
    source: 'rules',
  };
}

export async function generateWorkflow(text: string, ctx?: AgentContext): Promise<WorkflowDraft> {
  const schemas = await getWorkflowSchemas().catch(() => null);
  const draft = buildRuleDraft(text, ctx);

  if (schemas) {
    const network = extractNetwork(text) ?? defaultNetwork();
    const chain = getChainByNetwork(schemas, network);
    if (!chain) draft.missingFields.push('unsupportedChain');
  }

  return draft;
}
