import { BrokerMcpClient } from '../src/lib/broker/client';

async function main(): Promise<void> {
  const { existsSync } = await import('fs');
  const { join, resolve } = await import('path');
  const envPath = join(resolve(__dirname, '..'), '.env.local');
  if (existsSync(envPath)) {
    const { loadEnvFile } = await import('node:process');
    (loadEnvFile as unknown as (p: string) => void)(envPath);
  }
  const client = new BrokerMcpClient();
  const queries = ['liquidation risk', 'yield', 'portfolio health', 'aave', 'defi', 'snapshot'];
  const seen = new Map<string, { slug: string; id: string; name: string; priceUsdcPerCall: number; organizationId: string; listedAt: string; chain: string | null }>();
  for (const q of queries) {
    try {
      const items = await client.searchWorkflows(q, { sort: 'popular' });
      for (const it of items) {
        if (!it.isListed || !it.slug) continue;
        if (!seen.has(it.slug)) {
          seen.set(it.slug, {
            slug: it.slug,
            id: it.id,
            name: it.name,
            priceUsdcPerCall: Number(it.priceUsdcPerCall ?? 0),
            organizationId: it.organizationId,
            listedAt: it.listedAt,
            chain: it.chain,
          });
        }
      }
    } catch (e) {
      console.log(`query "${q}" failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(JSON.stringify([...seen.values()], null, 2));
}

void main();
