import { BrokerMcpClient } from './client';
import { ProviderError } from '@/lib/keeperhub/providers/http';
import type { JobSpec, ListingCandidate } from './types';

const SEARCH_LIMIT = 30;

function shortTokens(text: string, max = 3): string[] {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !/^(the|and|for|with|you|get|give|show|check|look|find|budget|price|usdc|base)$/.test(t))
    .slice(0, max);
}

async function searchPass(client: BrokerMcpClient, query: string, chainId: number | null): Promise<ListingCandidate[]> {
  const results = await client.searchWorkflows(query, { sort: 'popular' });
  const listed = results.filter((c) => c.isListed && c.slug);
  const onChain = listed.filter((c) => !chainId || !c.chain || c.chain === String(chainId) || c.chain === Number(chainId).toString());
  return onChain;
}

export async function discover(spec: JobSpec, client: BrokerMcpClient): Promise<ListingCandidate[]> {
  // Pass 1: the LLM/heuristic query words.
  let found = await searchPass(client, spec.query, spec.chainId);

  // Pass 2: short keyword query derived from the goal.
  if (found.length === 0) {
    const keywords = shortTokens(`${spec.goal} ${spec.query}`).join(' ');
    if (keywords.length > 2) found = await searchPass(client, keywords, spec.chainId);
  }

  // Pass 3: broad domain query so the demo still finds relevant listings.
  if (found.length === 0) {
    const broad = /aave|liquid|health|risk|snapshot/i.test(spec.goal)
      ? 'liquidation risk'
      : /yield|rate|apy|compound|supply/i.test(spec.goal)
        ? 'yield'
        : 'defi';
    found = await searchPass(client, broad, spec.chainId);
  }

  if (found.length === 0) {
    throw new ProviderError({
      code: 'no_listings_found',
      message: `No live listings match "${spec.query || spec.goal}".`,
      hint: 'Try a broader goal or raise the budget cap.',
    });
  }

  const inBudget = found.filter((c) => c.priceUsdcPerCall <= (spec.maxPriceUsdc ?? 0));
  const pool = inBudget.length > 0 ? inBudget : found;

  return pool.slice(0, SEARCH_LIMIT);
}