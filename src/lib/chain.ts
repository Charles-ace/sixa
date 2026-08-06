import { createPublicClient, http, formatUnits, type Address } from 'viem';
import { mainnet, arbitrum, base, optimism, polygon, avalanche } from 'viem/chains';
import { SUPPORTED_NETWORKS } from './types';

const publicClients = {
  1: createPublicClient({ chain: mainnet, transport: http(SUPPORTED_NETWORKS[0].rpc) }),
  42161: createPublicClient({ chain: arbitrum, transport: http(SUPPORTED_NETWORKS[1].rpc) }),
  8453: createPublicClient({ chain: base, transport: http(SUPPORTED_NETWORKS[2].rpc) }),
  10: createPublicClient({ chain: optimism, transport: http(SUPPORTED_NETWORKS[3].rpc) }),
  137: createPublicClient({ chain: polygon, transport: http(SUPPORTED_NETWORKS[4].rpc) }),
  43114: createPublicClient({ chain: avalanche, transport: http(SUPPORTED_NETWORKS[5].rpc) }),
};

export interface TokenBalance {
  symbol: string;
  balance: number;
  usdValue: number;
  change24h: number;
}

export interface WalletPortfolio {
  address: string;
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  nativeBalance: number;
  nativeUsdValue: number;
  tokens: TokenBalance[];
  totalUsd: number;
}

const STABLE_PRICE = { USDC: 1, USDT: 1, DAI: 1 };
const USD_PRICES: Record<string, number> = { ETH: 3200, WETH: 3200, WBTC: 96000, stETH: 3090, POL: 0.5, AVAX: 30, ...STABLE_PRICE };

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] },
] as const;

const WELL_KNOWN_TOKENS: Record<number, { symbol: string; address: Address; decimals: number }[]> = {
  1: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
    { symbol: 'stETH', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', decimals: 18 },
  ],
  8453: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  ],
};

export function getPublicClient(chainId: number) {
  return publicClients[chainId as keyof typeof publicClients] ?? publicClients[1];
}

export function getChainInfo(chainId: number) {
  return SUPPORTED_NETWORKS.find((n) => n.chainId === chainId) ?? SUPPORTED_NETWORKS[0];
}

export function getUsdPrice(symbol: string, chainId = 1): number {
  return USD_PRICES[symbol] ?? USD_PRICES[symbol === 'POL' && chainId !== 137 ? 'POL' : symbol] ?? 0;
}

export async function getWalletPortfolio(address: Address, chainId = 1): Promise<WalletPortfolio> {
  const client = getPublicClient(chainId);
  const chain = getChainInfo(chainId);

  const nativeBalanceWei = await client.getBalance({ address }).catch(() => 0n);
  const nativeBalance = Number(formatUnits(nativeBalanceWei, 18));
  const nativePrice = USD_PRICES[chain.symbol] ?? 0;
  const nativeUsdValue = nativeBalance * nativePrice;

  const knownTokens = WELL_KNOWN_TOKENS[chainId] ?? [];
  const tokens: TokenBalance[] = [];

  for (const token of knownTokens) {
    try {
      const balance = await client.readContract({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      const formatted = Number(formatUnits(balance, token.decimals));
      const price = getUsdPrice(token.symbol, chainId);
      if (formatted > 0) {
        tokens.push({ symbol: token.symbol, balance: formatted, usdValue: formatted * price, change24h: 0 });
      }
    } catch {
      // token query failed — skip
    }
  }

  const tokenUsd = tokens.reduce((sum, t) => sum + t.usdValue, 0);

  return {
    address,
    chainId,
    chainName: chain.name,
    nativeSymbol: chain.symbol,
    nativeBalance,
    nativeUsdValue,
    tokens,
    totalUsd: nativeUsdValue + tokenUsd,
  };
}

export async function getBalance(address: Address, chainId: number, symbol?: string): Promise<TokenBalance[]> {
  const portfolio = await getWalletPortfolio(address, chainId);
  const results: TokenBalance[] = [{ symbol: portfolio.nativeSymbol, balance: portfolio.nativeBalance, usdValue: portfolio.nativeUsdValue, change24h: 0 }, ...portfolio.tokens];

  if (symbol) {
    const upper = symbol.toUpperCase();
    return results.filter((t) => t.symbol === upper || (upper === 'USDC' && t.symbol === 'USDC'));
  }
  return results;
}

export async function getRecentActivity(address: Address, chainId: number) {
  try {
    const client = getPublicClient(chainId);
    const block = await client.getBlockNumber();
    return { latestBlock: Number(block), address, chainId, fetchedAt: new Date().toISOString() };
  } catch {
    return { latestBlock: 0, address, chainId, fetchedAt: new Date().toISOString() };
  }
}

export const chainDisplayNames: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  8453: 'Base',
  10: 'Optimism',
  137: 'Polygon',
  43114: 'Avalanche',
};
