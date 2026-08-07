import { getUsdPrice } from './chain';

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'ethereum',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  stETH: 'staked-ether',
  POL: 'polygon-ecosystem-token',
  AVAX: 'avalanche-2',
};

const CACHE_TTL_MS = 60 * 1000;
const cache: { prices: Record<string, number> | null; fetchedAt: number } = {
  prices: null,
  fetchedAt: 0,
};

async function fetchPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache.prices && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prices;
  }

  const ids = Array.from(new Set(Object.values(COINGECKO_IDS))).join(',');
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`,
    { next: { revalidate: 60 }, headers: { accept: 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Market data unavailable (${response.status})`);
  }

  const data = (await response.json()) as Record<string, { usd?: number }>;
  const prices: Record<string, number> = {};
  for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
    const value = data[id]?.usd;
    if (typeof value === 'number' && value > 0) prices[symbol] = value;
  }

  cache.prices = prices;
  cache.fetchedAt = now;
  return prices;
}

export async function getLiveUsdPrice(symbol: string, chainId = 8453): Promise<number> {
  const normalized = symbol.toUpperCase();
  try {
    const prices = await fetchPrices();
    if (prices[normalized]) return prices[normalized];
  } catch {
    // fall through to the bundled reference table
  }
  return getUsdPrice(normalized, chainId);
}