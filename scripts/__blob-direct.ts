import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { get, list } from "@vercel/blob";

async function main() {
  console.log("=== blob.list(prefix='sixa/') ===");
  const listing = await list({ prefix: "sixa/" });
  for (const b of listing.blobs) {
    console.log(`  pathname=${b.pathname} size=${b.size} uploadedAt=${b.uploadedAt} url=${b.url}`);
  }
  console.log(`total: ${listing.blobs.length}`);

  console.log("\n=== get(sixa/broker-jobs.json) default auth ===");
  try {
    const res = await get("sixa/broker-jobs.json", { access: "private" });
    if (!res || res.statusCode !== 200 || !res.stream) {
      console.log(`status ${res?.statusCode ?? "?"} stream=${Boolean(res?.stream)}`);
      return;
    }
    const text = await new Response(res.stream).text();
    const parsed = JSON.parse(text) as { jobs?: Array<{ id: string; status: string; updatedAt: string; audit?: unknown[] }> };
    console.log(`jobs in snapshot: ${parsed.jobs?.length ?? 0}`);
    for (const j of parsed.jobs ?? []) console.log(`  id=${j.id} status=${j.status} audit=${j.audit?.length ?? 0} updatedAt=${j.updatedAt}`);
  } catch (error) {
    console.log(`GET FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
}
main().catch(console.error);