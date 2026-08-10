import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const ORG_WALLET = "0xF3B2834B3f6FD105d3fCDb666F08b2E2Dc2E0c61";
async function main() {
  const payerPk = process.env.BROKER_PAYER_PRIVATE_KEY ?? "";
  const rpcSepolia = process.env.BROKER_PAYER_RPC_URL ?? "https://sepolia.base.org";
  console.log(`BROKER_PAYER_PRIVATE_KEY present: ${payerPk.length > 0}`);
  console.log(`BROKER_PAYER_CHAIN_ID: ${process.env.BROKER_PAYER_CHAIN_ID}`);

  const payer = privateKeyToAccount(payerPk as `0x${string}`);
  console.log(`broker payer address: ${payer.address}`);
  console.log(`org wallet address:   ${ORG_WALLET}`);

  const sepolia = createPublicClient({ transport: http(rpcSepolia) });
  const mainnet = createPublicClient({ transport: http("https://mainnet.base.org") });

  const fmt = (wei: bigint) => `${(Number(wei) / 1e18).toFixed(8)} ETH (${wei.toString()} wei)`;
  console.log(`\nbroker payer balance (sepolia.base.org / 84532): ${fmt(await sepolia.getBalance({ address: payer.address }))}`);
  console.log(`org wallet balance (sepolia.base.org / 84532):    ${fmt(await sepolia.getBalance({ address: ORG_WALLET }))}`);
  console.log(`org wallet balance (mainnet.base.org / 8453):     ${fmt(await mainnet.getBalance({ address: ORG_WALLET }))}`);
}
main().catch(console.error);
