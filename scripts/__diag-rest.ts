import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch {}
const API_KEY = process.env.KEEPERHUB_API_KEY ?? "";
const BASE = "https://app.keeperhub.com";
async function probe(path: string, method = "GET", body?: unknown, extraHeaders?: Record<string, string>) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}`, ...(extraHeaders ?? {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    console.log(`${method} ${path} -> HTTP ${res.status}`);
    console.log(text.slice(0, 600));
    console.log("---");
    return text;
  } catch (e) {
    console.log(`${method} ${path} -> ERROR ${e instanceof Error ? e.message : String(e)}`);
    return "";
  }
}
async function main() {
  await probe("/api/workflows");
  await probe("/api/workflows/9ddjdvhrqouokxzmf42xn");
  await probe("/api/me");
  await probe("/api/org");
  await probe("/api/organization");
  await probe("/api/billing");
  await probe("/api/billing/plan");
  await probe("/api/plans");
  await probe("/.well-known/oauth-protected-resource");
  const oauth = await fetch(`${BASE}/.well-known/oauth-authorization-server`, { cache: "no-store" });
  console.log(`GET /.well-known/oauth-authorization-server -> HTTP ${oauth.status}`);
  console.log((await oauth.text()).slice(0, 600));
  console.log("---");
  await probe("/api/workflows/9ddjdvhrqouokxzmf42xn/execute", "POST", {});
}
main().catch(console.error);
