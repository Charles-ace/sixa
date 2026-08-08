import type { ParsedIntent, SimulationResult } from './types';
import { ACTION_LABELS } from './intent-parser';

export const SIXA_SYSTEM_PROMPT = `You are Sixa, an AI on-chain execution assistant. You help users interact with blockchain protocols using natural language.

You reason about blockchain actions and prepare secure transactions executed through KeeperHub.

Your capabilities:
- Swap tokens
- Bridge assets across chains
- Stake ETH
- Check balances and portfolio
- Show transaction history

ALWAYS explain yourself before any action:
1. What the user asked for (parsed intent)
2. What the action will do (expected outcome)
3. Estimated gas cost
4. Any warnings (slippage, lockup, risk)
5. Ready-to-execute status

Rules:
- Never invent real transaction hashes, prices, or balances. Use the data provided in context.
- If asked for real-time data you don't have, say so and suggest what you can do.
- Be concise, structured, and professional.
- If the intent is unclear, ask a single clarifying question.
- When presenting a transaction, always mention KeeperHub powers the secure execution.
- Format responses with short lines and bullet points where helpful.`;

export function buildIntentExplanation(intent: ParsedIntent, simulation?: SimulationResult, walletConnected = false): string {
  const action = ACTION_LABELS[intent.type];
  const lines: string[] = [];

  if (intent.type === 'unknown') {
    lines.push('I need a bit more detail to help with that.');
    lines.push('I can help you with:');
    lines.push('');
    lines.push('• Swap — "Swap 100 USDC to ETH"');
    lines.push('• Bridge — "Bridge 500 USDC to Base"');
    lines.push('• Stake — "Stake my ETH"');
    lines.push('• Portfolio — "Show my portfolio"');
    lines.push('• Balance — "How much ETH do I have?"');
    return lines.join('\n');
  }

  if (['portfolio', 'balance', 'history'].includes(intent.type)) {
    if (!walletConnected) {
      lines.push(`I'd like to ${intent.type === 'balance' ? 'check your balances' : intent.type === 'history' ? 'pull your recent activity' : 'build your portfolio overview'}, but your wallet isn't connected yet.`);
      lines.push('');
      lines.push('Connect your wallet first and I\u2019ll show you the details.');
      return lines.join('\n');
    }
    lines.push(`Here's what I'll do:`);
    lines.push('');
    lines.push(`• ${action}`);
    if (intent.type === 'balance' && intent.params?.toToken) {
      lines.push(`• Token: ${intent.params.toToken}`);
    }
    lines.push('');
    lines.push('Pulling live data from the chain now…');
    return lines.join('\n');
  }

  const amount = intent.params?.amount;
  const from = intent.params?.fromToken ?? 'token';
  const to = intent.params?.toToken ?? 'token';

  lines.push(`This transaction will:`);
  lines.push('');
  lines.push(`• ${action} ${amount ? `${amount} ` : ''}${from}${intent.type === 'swap' && to ? ` → ${to}` : ''}`);
  if (intent.type === 'bridge' && intent.params?.targetChain) {
    lines.push(`• Destination: ${intent.params.targetChain}`);
    lines.push('• Cross-chain bridge execution is in beta — routes depend on KeeperHub bridge availability.');
  }
  if (intent.type === 'stake' && intent.params?.protocol) {
    lines.push(`• Protocol: ${intent.params.protocol}`);
  }

  if (simulation) {
    lines.push('');
    if (!simulation.success) {
      lines.push(`⚠ Simulation failed: ${simulation.revertReason ?? 'the provider could not simulate this transaction.'}`);
      if (simulation.errorCode) lines.push(`• Error code: \`${simulation.errorCode}\``);
      if (simulation.unsupported?.suggestion) lines.push(`• ${simulation.unsupported.suggestion}`);
      if (simulation.simulated) lines.push('• This is a dev simulation — no real transaction was prepared.');
      lines.push('');
      lines.push('Nothing was sent. Fix the issue above or try a different request.');
      return lines.join('\n');
    }
    if (simulation.gasEstimateUsd != null) {
      lines.push(`• Estimated gas: $${simulation.gasEstimateUsd.toFixed(2)}`);
    } else if (simulation.gasEstimateUnits) {
      lines.push(`• Estimated gas: ${simulation.gasEstimateUnits} units (live simulation)`);
    }
    if (simulation.strategy) lines.push(`• Gas strategy: ${simulation.strategy}`);
    lines.push(`• ${simulation.expectedOutcome}`);
    if (simulation.warnings.length > 0) {
      lines.push('');
      simulation.warnings.forEach((w) => lines.push(`⚠ ${w}`));
    }
    lines.push('');
    lines.push(simulation.simulated
      ? 'Transaction simulation completed (dev mode — not a real preflight).'
      : 'Transaction simulation completed successfully on chain.');
  } else {
    lines.push('');
    lines.push('I\'ll simulate the transaction before proposing execution.');
  }

  lines.push('');
  lines.push('Ready to execute securely through KeeperHub.');

  return lines.join('\n');
}

export function buildExecutionResultMessage(action: string, txHash: string, gasUsd: number): string {
  return [
    `Execution complete.`,
    '',
    `• Action: ${action}`,
    `• Gas used: $${gasUsd.toFixed(2)}`,
    `• Status: ✅ Confirmed`,
    '',
    `Transaction hash:`,
    `\`${txHash}\``,
    '',
    'Execution was audited and logged by KeeperHub.',
  ].join('\n');
}

export function buildClarification(intent: ParsedIntent): string {
  if (intent.type === 'swap' && !intent.params?.toToken) {
    return 'Which token would you like to swap to? (e.g. "Swap 100 USDC to ETH")';
  }
  if (intent.type === 'bridge' && !intent.params?.targetChain) {
    return 'Which chain would you like to bridge to? (Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche)';
  }
  if (intent.type === 'send' && !intent.params?.address) {
    return 'Which address would you like to send to? (paste a 0x address)';
  }
  return 'Could you rephrase that? I can help with swaps, bridges, staking, and portfolio questions.';
}
