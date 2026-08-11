import { privateKeyToAccount } from "viem/accounts";

const TARGET = "0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc".toLowerCase();

// Standard Anvil / Hardhat / Foundry test keys (publicly documented)
const anvil = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2c0e54cf921636d11f8db05ddfc3d38f8f0bf3",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];
const hardhat = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2c0e54cf921636d11f8db05ddfc3d38f8f0bf3",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
  "0xf214f2b2cd398c806f84e317254e0f0fe801d51e6e4f3f3f2c4e2e2f5e5d5d5d",
];
const bro = process.env.BROKER_PAYER_PRIVATE_KEY ?? "";

function check(list: string[], label: string) {
  for (const pk of list) {
    try {
      const a = privateKeyToAccount(pk as `0x${string}`);
      const addr = a.address.toLowerCase();
      if (addr === TARGET) console.log(`MATCH! ${label} key derives to owner address`);
    } catch {}
  }
}

check(anvil, "anvil");
check(hardhat, "hardhat");
const { loadEnvFile } = require("node:process");
try { loadEnvFile(".env.local"); } catch {}
console.log("payer address:", privateKeyToAccount((process.env.BROKER_PAYER_PRIVATE_KEY ?? "") as `0x${string}`).address);
console.log("owner match check done. Target:", TARGET);
