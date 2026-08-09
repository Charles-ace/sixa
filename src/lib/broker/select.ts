import type { JobSpec, ListingCandidate } from './types';

export interface SelectionResult {
  selected: ListingCandidate;
  runnerUp: ListingCandidate | null;
  reason: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'get', 'give', 'show', 'check', 'look',
  'a', 'an', 'of', 'to', 'on', 'my', 'i', 'want', 'please', 'just', 'can', 'me',
  'pay', 'paid', 'price', 'usdc', 'this', 'that', 'use', 'using', 'have',
]);

function normalizeTokens(text: string): string[] {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function scoreFor(candidate: ListingCandidate, spec: JobSpec): number {
  const goalTokens = normalizeTokens(`${spec.goal} ${spec.query}`);
  const nameTokens = new Set(normalizeTokens(candidate.name));
  const descTokens = new Set(normalizeTokens(candidate.description));

  let score = 0;
  const matched: string[] = [];

  for (const token of goalTokens) {
    if (nameTokens.has(token)) {
      score += 3;
      matched.push(token);
    } else if (descTokens.has(token)) {
      score += 1.5;
      matched.push(token);
    }
  }

  const cap = spec.maxPriceUsdc ?? 0;
  if (cap > 0) {
    const ratio = candidate.priceUsdcPerCall / cap;
    if (ratio <= 0.5) score += 2;
    else if (ratio <= 1) score += 1;
    else score -= 4;
  }

  const callCount = Number(candidate.callCount) || 0;
  score += Math.min(callCount, 100) / 20;

  if (candidate.workflowType === 'read') score += 0.5;

  return score;
}

/**
 * Best keyword-match score across the candidates. Used to decide whether a
 * listing is actually relevant to the intent — below the threshold the
 * broker should build a workflow instead of trying unrelated listings.
 */
export function bestMatchScore(spec: JobSpec, candidates: ListingCandidate[]): number {
  if (candidates.length === 0) return 0;
  let best = -Infinity;
  for (const candidate of candidates) {
    best = Math.max(best, scoreFor(candidate, spec));
  }
  return best;
}

function matchedTokensFor(candidate: ListingCandidate, spec: JobSpec): string[] {
  const goalTokens = normalizeTokens(`${spec.goal} ${spec.query}`);
  const tokensIn = new Set([...normalizeTokens(candidate.name), ...normalizeTokens(candidate.description)]);
  return goalTokens.filter((t) => tokensIn.has(t));
}

export function select(spec: JobSpec, candidates: ListingCandidate[]): SelectionResult {
  if (candidates.length === 0) {
    throw new Error('Selection requires at least one candidate.');
  }

  const sorted = [...candidates].sort((a, b) => {
    const diff = scoreFor(b, spec) - scoreFor(a, spec);
    if (diff !== 0) return diff;
    return a.priceUsdcPerCall - b.priceUsdcPerCall;
  });

  const selected = sorted[0];
  const runnerUp = sorted[1] ?? null;
  const matched = matchedTokensFor(selected, spec);

  const reasonParts = [
    `Selected "${selected.name}" (${selected.slug}) from ${candidates.length} live candidates.`,
    `Price $${selected.priceUsdcPerCall.toFixed(2)}/call is within the $${(spec.maxPriceUsdc ?? 0).toFixed(2)} cap.`,
    matched.length > 0 ? `Keyword match: ${matched.slice(0, 6).join(', ')}.` : 'Selected by best overall fit: price cap and read-only profile.',
    Number(selected.callCount) > 0
      ? `Reputation: ${selected.callCount} prior calls on the catalog.`
      : runnerUp
        ? 'New listing with no prior call volume — a runner-up candidate is held as fallback.'
        : 'New listing with no prior call volume — no fallback candidate available.',
    selected.workflowType === 'read' ? 'Read-only workflow: no on-chain write is associated with the call.' : 'Write workflow: execution may produce on-chain calldata.',
  ];

  return {
    selected,
    runnerUp,
    reason: reasonParts.filter(Boolean).join('\n'),
  };
}