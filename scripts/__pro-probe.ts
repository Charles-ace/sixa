import { readFileSync } from 'fs';
import { join } from 'path';
const envPath = join(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const URL = 'https://app.keeperhub.com/mcp';
let sessionId: string | null = null;
let rpcId = 1;
async function rpc(method: string, params?: Record<string, unknown>) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer ' + process.env.KEEPERHUB_API_KEY,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}), ...(method !== 'notifications/initialized' ? { id: rpcId++ } : {}) }),
  });
  const sid = res.headers.get('Mcp-Session-Id');
  if (sid) sessionId = sid;
  return { status: res.status, raw: await res.text() };
}
function innerText(raw: string): string {
  try {
    const env = JSON.parse(raw) as { result?: { content?: Array<{ type: string; text?: string }> } };
    if (env.result && Array.isArray(env.result.content)) {
      const t = env.result.content.filter((c) => c.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('\n');
      if (t.trim()) return t.trim();
    }
  } catch {}
  return raw.trim();
}
async function main() {
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'sixa-pro-test', version: '1' } });
  await rpc('notifications/initialized', {});

  console.log('--- get_spending_limits ---');
  const s = await rpc('tools/call', { name: 'get_spending_limits', arguments: {} });
  console.log(innerText(s.raw).slice(0, 500));

  console.log('\n--- call_workflow sixa-aave-tempo (did Pro change the 402 gate?) ---');
  const c = await rpc('tools/call', { name: 'call_workflow', arguments: { slug: 'sixa-aave-tempo', inputs: { address: '0x30C8A36e99f0708c3e3301b1Ed99cf418BDCf27a' } } });
  console.log('HTTP', c.status);
  console.log(innerText(c.raw).slice(0, 1200));
}
main().catch((e) => { console.error(e); process.exit(1); });