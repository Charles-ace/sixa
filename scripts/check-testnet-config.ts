import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther, parseAbi } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { existsSync } from 'fs';
import { join } from 'path';

// Load .env.local
try {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    const { loadEnvFile } = require('node:process');
    loadEnvFile(envPath);
  }
} catch {}

const USDC_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

// Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
// Base Mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function main() {
  const privateKey = process.env.BROKER_PAYER_PRIVATE_KEY;
  let accountAddress = 'Not configured';
  if (privateKey) {
    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      accountAddress = account.address;
    } catch {
      accountAddress = 'Invalid private key';
    }
  }

  const clientSepolia = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });
  const clientMainnet = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });

  let ethBalanceSepolia = '0';
  let usdcBalanceSepolia = '0';
  let ethBalanceMainnet = '0';
  let usdcBalanceMainnet = '0';

  if (accountAddress.startsWith('0x')) {
    try {
      const bSep = await clientSepolia.getBalance({ address: accountAddress as `0x${string}` });
      ethBalanceSepolia = formatEther(bSep);
    } catch {}

    try {
      const uSep = await clientSepolia.readContract({
        address: USDC_BASE_SEPOLIA,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [accountAddress as `0x${string}`],
      });
      usdcBalanceSepolia = (Number(uSep) / 1e6).toFixed(2);
    } catch {}

    try {
      const bMain = await clientMainnet.getBalance({ address: accountAddress as `0x${string}` });
      ethBalanceMainnet = formatEther(bMain);
    } catch {}

    try {
      const uMain = await clientMainnet.readContract({
        address: USDC_BASE_MAINNET,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [accountAddress as `0x${string}`],
      });
      usdcBalanceMainnet = (Number(uMain) / 1e6).toFixed(2);
    } catch {}
  }

  console.log(JSON.stringify({
    keeperhub: {
      endpoint: process.env.KEEPERHUB_ENDPOINT ?? 'https://app.keeperhub.com',
      mcpEndpoint: process.env.KEEPERHUB_MCP_ENDPOINT ?? 'https://app.keeperhub.com/mcp',
      chainId: process.env.KEEPERHUB_CHAIN_ID ?? 'not set',
      transport: process.env.KEEPERHUB_TRANSPORT ?? 'rest',
      environment: process.env.KEEPERHUB_ENVIRONMENT ?? 'auto-detect (testnet when chainId=84532)',
      apiKeyConfigured: Boolean(process.env.KEEPERHUB_API_KEY),
    },
    brokerPayer: {
      address: accountAddress,
      chainId: process.env.BROKER_PAYER_CHAIN_ID ?? 'not set',
      rpcUrl: process.env.BROKER_PAYER_RPC_URL ?? 'https://mainnet.base.org',
    },
    sepoliaBalances: {
      chainId: 84532,
      network: 'Base Sepolia Testnet',
      ethGas: ethBalanceSepolia,
      usdcBudget: usdcBalanceSepolia,
    },
    mainnetBalances: {
      chainId: 8453,
      network: 'Base Mainnet',
      ethGas: ethBalanceMainnet,
      usdcBudget: usdcBalanceMainnet,
    }
  }, null, 2));
}

main().catch(console.error);
