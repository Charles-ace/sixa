import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
import { put, get, list, del } from "@vercel/blob";

async function main() {
  console.log("=== probe: which access mode works on this (private) store ===");
  const marker = `probe-${Date.now()}`;
  for (const access of ["private"] as const) {
    try {
      const up = await put("sixa/__probe.json", JSON.stringify({ marker, access }), { access, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
      const g = await get("sixa/__probe.json", { access });
      const text = g?.stream ? await new Response(g.stream).text() : `no-stream status=${g?.statusCode}`;
      console.log(`access='${access}': put ok ${up.url.slice(0, 60)}... get -> ${text.slice(0, 80)}`);
      await del("sixa/__probe.json");
      console.log(`access='${access}': deleted ok`);
    } catch (error) {
      console.log(`access='${access}': FAILED — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const all = await list({ prefix: "sixa/" });
  console.log(`\nfinal list sixa/ -> ${all.blobs.length} blobs`);
  for (const b of all.blobs) console.log(`  ${b.pathname} (${b.size}b)`);
}
main().catch((e) => console.log(`FAILED: ${e instanceof Error ? e.message : String(e)}`));