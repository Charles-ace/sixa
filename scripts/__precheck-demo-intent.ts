import { loadEnvFile } from 'node:process';
import { existsSync } from 'fs';
import { join } from 'path';
import { BrokerMcpClient } from '../src/lib/broker/client';
import { discover } from '../src/lib/broker/discover';
import { bestMatchScore } from '../src/lib/broker/select';
import { intake } from '../src/lib/broker/intake';

try {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) loadEnvFile(envPath);
} catch {}

const MESSAGE = process.env.DEMO_MESSAGE ?? 'Verify the anchor commitment on Base for the demo run';

async function main() {
  console.log('MESSAGE:', MESSAGE);
  const spec = await intake({ message: MESSAGE, budgetUsdc: 0.5 });
  console.log('SPEC:', JSON.stringify(spec, null, 2));
  const client = new BrokerMcpClient();
  const result = await discover(spec, client);
  console.log('PASSES:', JSON.stringify(result.passes, null, 2));
  console.log('CANDIDATES:', result.candidates.length);
  for (const c of result.candidates) {
    console.log(`  - ${c.slug} ($${c.priceUsdcPerCall}) ${c.name}`);
  }
  const best = bestMatchScore(spec, result.candidates);
  console.log('BEST MATCH SCORE:', best, 'THRESHOLD: 4');
  console.log(best < 4 ? 'VERDICT: FALLBACK PATH' : 'VERDICT: MARKETPLACE PATH');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
export {};
