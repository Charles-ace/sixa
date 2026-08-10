import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
const ORG_WALLET = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
const RPC = process.env.BROKER_PAYER_RPC_URL ?? "https://sepolia.base.org";
const payerPk = process.env.BROKER_PAYER_PRIVATE_KEY ?? "";
async function main() {
  const account = privateKeyToAccount(payerPk as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

  const before = await publicClient.getBalance({ address: ORG_WALLET });
  console.log(`org wallet balance BEFORE: ${formatEther(before)} ETH`);

  const amount = parseEther("0.001");
  const hash = await walletClient.sendTransaction({ to: ORG_WALLET, value: amount, chain: baseSepolia });
  console.log(`funding tx sent: ${hash}`);
  console.log(`waiting for confirmation...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`receipt status: ${receipt.status} block: ${receipt.blockNumber} gasUsed: ${receipt.gasUsed}`);

  const after = await publicClient.getBalance({ address: ORG_WALLET });
  console.log(`org wallet balance AFTER: ${formatEther(after)} ETH`);
  const payer = await publicClient.getBalance({ address: account.address });
  console.log(`payer wallet balance now: ${formatEther(payer)} ETH`);
  console.log(`explorer: https://sepolia.basescan.org/tx/${hash}`);
}
main().catch(console.error);
