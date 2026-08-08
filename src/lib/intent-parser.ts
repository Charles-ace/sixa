import type { ParsedIntent, ActionType } from './types';

const TOKEN_ALIASES: Record<string, string> = {
  usdc: 'USDC', usdcoin: 'USDC', 'usd coin': 'USDC',
  usdt: 'USDT', tether: 'USDT',
  eth: 'ETH', ether: 'ETH', ethereum: 'ETH',
  weth: 'WETH', 'wrapped eth': 'WETH',
  dai: 'DAI', wbtc: 'WBTC', 'wrapped bitcoin': 'WBTC',
  steth: 'stETH', 'staked eth': 'stETH', 'staked ether': 'stETH',
  matic: 'POL', pol: 'POL', avax: 'AVAX',
};

const CHAIN_ALIASES: Record<string, string> = {
  ethereum: 'Ethereum', mainnet: 'Ethereum', eth: 'Ethereum',
  arbitrum: 'Arbitrum', arb: 'Arbitrum', arbi: 'Arbitrum',
  base: 'Base',
  optimism: 'Optimism', op: 'Optimism', 'optimism mainnet': 'Optimism',
  polygon: 'Polygon', matic: 'Polygon', poly: 'Polygon',
  avalanche: 'Avalanche', avax: 'Avalanche',
};

const PROTOCOL_ALIASES: Record<string, string> = {
  lido: 'Lido', rocketpool: 'Rocket Pool', aave: 'Aave', compound: 'Compound', uniswap: 'Uniswap',
};

function normalizeToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return TOKEN_ALIASES[key] ?? raw.trim().toUpperCase();
}

function normalizeChain(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return CHAIN_ALIASES[key] ?? raw.trim().toLowerCase();
}

function extractAmount(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*[kKmM]?/);
  if (!match) return undefined;
  let amount = parseFloat(match[1]);
  const suffix = match[0].trim().match(/[kKmM]$/)?.[0]?.toLowerCase();
  if (suffix === 'k') amount *= 1000;
  if (suffix === 'm') amount *= 1_000_000;
  return amount;
}

function extractToken(text: string, amount: number | undefined): string | undefined {
  const afterAmount = amount !== undefined ? text.slice(text.indexOf(String(amount)) + String(amount).length) : text;
  const match = afterAmount.match(/(?:of\s+)?([A-Za-z$\u20ac]{2,10})/);
  return match ? normalizeToken(match[1]) : undefined;
}

const FILLER_WORDS = new Set([
  'how', 'much', 'do', 'i', 'have', 'what', 'my', 'the', 'is', 'my', 'in', 'on', 'of', 'would',
  'does', 'doe', 'show', 'for', 'about', 'me', 'please', 'and', 'a', 'an', 'balance', 'balances',
]);

function extractBalanceToken(text: string): string | undefined {
  const tokenMatch = text.match(/\b(ETH|WETH|USDC|USDT|DAI|WBTC|stETH|POL|AVAX)\b/i);
  if (tokenMatch) return normalizeToken(tokenMatch[1]);
  const words = text.replace(/[?.,!]/g, '').split(/\s+/).filter((w) => w.trim().length > 0);
  for (const word of words) {
    if (FILLER_WORDS.has(word.toLowerCase())) continue;
    const normalized = normalizeToken(word);
    if (normalized) return normalized;
  }
  return undefined;
}

function isBalanceQuestion(text: string): boolean {
  return /(how much|what.*(?:hold|own|have)|balance of|balance for|check.*balance|show.*balance)/i.test(text);
}

function isHistoryQuestion(text: string): boolean {
  return /(recent activity|transaction history|my transactions|past transactions|show.*activity|history)/i.test(text);
}

function isPortfolioQuestion(text: string): boolean {
  return /(show my (portfolio|wallet|assets|holdings)|portfolio|what do i own|my assets|my holdings)/i.test(text);
}

function parseSwap(text: string): ParsedIntent {
  const amount = extractAmount(text);
  const fromToken = extractToken(text, amount);
  const toMatch = text.match(/(?:to|into|for|in)\s+([A-Za-z$]{2,10})\b/i);
  const toToken = toMatch ? normalizeToken(toMatch[1]) : undefined;

  return {
    type: 'swap',
    confidence: 0.92,
    raw: text,
    params: { fromToken, toToken, amount },
    reasoning: [
      `Detected swap intent with${amount ? ` amount ${amount}` : ' unspecified amount'}.`,
      `Token path: ${fromToken ?? 'unknown'} → ${toToken ?? 'unknown'}.`,
      'Will simulate on-chain before proposing execution.',
    ],
  };
}

function parseBridge(text: string): ParsedIntent {
  const amount = extractAmount(text);
  const fromToken = extractToken(text, amount) ?? 'USDC';
  const toMatch = text.match(/(?:to|onto|over to|into)\s+([A-Za-z]+)\b/i);
  const targetChain = toMatch ? normalizeChain(toMatch[1]) : undefined;

  return {
    type: 'bridge',
    confidence: 0.9,
    raw: text,
    params: { fromToken, toToken: fromToken, amount, targetChain },
    reasoning: [
      `Detected bridge intent${targetChain ? ` to ${targetChain}` : ' (chain unspecified)'}.`,
      `Asset: ${fromToken}${amount ? `, amount ${amount}` : ''}.`,
      'Cross-chain bridge routing is in beta on KeeperHub — availability depends on the route and provider.',
    ],
  };
}

function parseStake(text: string): ParsedIntent {
  const amount = extractAmount(text);
  const protocolMatch = text.match(/(?:via|through|on)\s+([A-Za-z ]{2,20})/i);
  const protocol = protocolMatch ? PROTOCOL_ALIASES[protocolMatch[1].toLowerCase()] ?? protocolMatch[1] : undefined;
  const token = /stake\s+(?:my\s+)?([A-Za-z]+)/i.exec(text)?.[1];

  return {
    type: 'stake',
    confidence: 0.88,
    raw: text,
    params: { fromToken: normalizeToken(token) ?? 'ETH', amount, protocol },
    reasoning: [
      'Detected staking intent.',
      `${protocol ? `Preferred protocol: ${protocol}` : 'Will select safest protocol automatically.'}`,
      'Staking changes your ETH exposure — will show full breakdown before executing.',
    ],
  };
}

function parseSend(text: string): ParsedIntent {
  const amount = extractAmount(text);
  const token = extractToken(text, amount) ?? 'ETH';
  const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];

  return {
    type: 'send',
    confidence: 0.9,
    raw: text,
    params: { fromToken: token, amount, address },
    reasoning: [
      `Detected transfer of ${token}${amount ? `, amount ${amount}` : ''}.`,
      address ? `Destination: ${address.slice(0, 8)}...` : 'No destination address found — will ask before executing.',
      'Transfers are irreversible. Simulation will run first.',
    ],
  };
}

export function parseIntent(text: string): ParsedIntent {
  const clean = text.trim().toLowerCase();

  if (/\bswap\b|convert\b.*\bto\b|\bexchange\b.*\bto\b|sell\b|\bbuy\b/.test(clean)) return parseSwap(text);
  if (/\bbridge\b|\btransfer\b.*chain|move\b.*\bto\b.*(base|arb|eth|op|poly|avax|optimism|polygon|arbitrum|avalanche)|cross[- ]?chain/.test(clean)) return parseBridge(text);
  if (/\bstake\b|stake\s+my|yield on|earn\b/.test(clean)) return parseStake(text);
  if (/\bsend\b|\bpay\b|\btransfer\b.*to\b|0x[a-fA-F0-9]{40}/.test(clean)) return parseSend(text);
  if (isHistoryQuestion(clean)) {
    return { type: 'history', confidence: 0.95, raw: text, reasoning: ['Fetching recent on-chain activity for connected wallet.'] };
  }
  if (isPortfolioQuestion(clean)) {
    return { type: 'portfolio', confidence: 0.95, raw: text, reasoning: ['Building portfolio overview from on-chain balances.'] };
  }
  if (isBalanceQuestion(clean)) {
    const token = extractBalanceToken(text);
    return { type: 'balance', confidence: 0.9, raw: text, params: { toToken: token }, reasoning: ['Checking wallet balance from chain data.'] };
  }

  return {
    type: 'unknown',
    confidence: 0.2,
    raw: text,
    reasoning: ['Unable to map to a supported action. Asking user for clarification.'],
  };
}

export const ACTION_LABELS: Record<ActionType, string> = {
  swap: 'Swap',
  bridge: 'Bridge',
  stake: 'Stake',
  send: 'Send',
  portfolio: 'Portfolio Overview',
  balance: 'Balance Check',
  history: 'Transaction History',
  unknown: 'Clarify',
};

export function isExecutable(intent: ParsedIntent): boolean {
  return ['swap', 'bridge', 'stake', 'send'].includes(intent.type);
}
