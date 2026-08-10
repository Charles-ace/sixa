import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch {}

const API_KEY = process.env.KEEPERHUB_API_KEY ?? '';
const URL = process.env.KEEPERHUB_MCP_ENDPOINT ?? 'https://app.keeperhub.com/mcp';

let sessionId: string | null = null;
let rpcId = 1;

async function rpc(method: string, params?: Record<string, unknown>): Promise<{ status: number; raw: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${API_KEY}`,
    ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
  };
  const body: Record<string, unknown> = { jsonrpc: '2.0', method };
  if (params !== undefined) body.params = params;
  if (method !== 'notifications/initialized') {
    body.id = rpcId;
    rpcId += 1;
  }
  const res = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
  const sid = res.headers.get('Mcp-Session-Id');
  if (sid) sessionId = sid;
  const raw = await res.text();
  return { status: res.status, raw };
}

function innerText(raw: string): string {
  try {
    const envelope = JSON.parse(raw) as { result?: { content?: Array<{ type: string; text?: string }> }; error?: unknown };
    if (envelope.result && Array.isArray(envelope.result.content)) {
      const text = envelope.result.content.filter((c) => c.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('\n');
      if (text.trim()) return text.trim();
    }
  } catch {}
  return raw.trim();
}

function parseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    const v = JSON.parse(trimmed);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    const start = trimmed.indexOf('{');
    if (start === -1) return null;
    try {
      return JSON.parse(trimmed.slice(start)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function findString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = record[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function deepFind(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  for (const v of Object.values(record)) {
    if (typeof v === 'object' && v !== null) {
      const hit = deepFind(v, key);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('==========================================================');
  console.log('LIVE KEEPERHUB WRITE-WORKFLOW VERIFICATION (3-STEP FLOW)');
  console.log(`Endpoint: ${URL}`);
  console.log(`Key prefix: ${API_KEY.slice(0, 5)}… (${API_KEY.length} chars)`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('==========================================================\n');

  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'sixa-live-verify', version: '1.0.0' },
  });
  console.log('--- STEP 0: initialize ---');
  console.log(`HTTP ${init.status}`);
  console.log(init.raw);
  if (init.status !== 200) return;
  await rpc('notifications/initialized', {});

  console.log('\n--- STEP 0b: search write workflows available to this key ---');
  const search = await rpc('tools/call', { name: 'search_workflows', arguments: { query: 'rebalance sepolia', workflowType: 'write' } });
  console.log(`HTTP ${search.status}`);
  console.log(search.raw);
  let candidates: Array<Record<string, unknown>> = [];
  const itemsRaw = deepFind(parseJson(innerText(search.raw)), 'items');
  if (Array.isArray(itemsRaw)) {
    candidates = itemsRaw.filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null);
  }
  for (const c of candidates) {
    console.log(`  candidate slug=${JSON.stringify(c.listedSlug)} name=${JSON.stringify(c.name)} price=${JSON.stringify(c.priceUsdcPerCall)} type=${JSON.stringify(c.workflowType)}`);
  }

  // Prefer the requested slug, then any genuinely write-type listing.
  let slug = candidates.find((c) => String(c.listedSlug ?? '').includes('evoyield-sepolia-usdc-rebalancer'))?.listedSlug as string | undefined;
  if (!slug) {
    slug = candidates.find((c) => String(c.workflowType).toLowerCase() === 'write')?.listedSlug as string | undefined;
  }

  if (!slug) {
    console.log('\nNo write-type workflow found in catalog under this key. Trying the requested slug directly anyway...');
    slug = 'evoyield-sepolia-usdc-rebalancer';
  }

  console.log(`\n========== STEP 1: callWorkflow (slug="${slug}", inputs={"call":"rebalance"}) ==========`);
  const call = await rpc('tools/call', { name: 'call_workflow', arguments: { slug, inputs: { call: 'rebalance' } } });
  console.log(`HTTP ${call.status}`);
  console.log(call.raw);

  const callInner = parseJson(innerText(call.raw));
  if (callInner && 'x402Version' in callInner) {
    console.log('\nRESULT: call_workflow returned an x402 payment quote. Payment is required before execution. No executionId, nothing to poll, no transactionHash.');
    return;
  }
  if (call.status === 402) {
    console.log('\nRESULT: HTTP 402 Payment Required — quote returned by server, payment not made. No executionId, nothing to poll, no transactionHash.');
    return;
  }

  const executionId = findString(callInner, ['executionId', 'id']);
  if (!executionId) {
    console.log('\nRESULT: call_workflow did NOT return an executionId. waitForExecution and getExecution cannot be called with a null id. No transactionHash can be reported.');
    return;
  }

  console.log(`\n========== STEP 2: waitForExecution (polling get_execution every 3s, max 40 polls) ==========`);
  let finalRaw: string | null = null;
  let terminal = false;
  for (let poll = 1; poll <= 40; poll += 1) {
    await sleep(3000);
    const statusRes = await rpc('tools/call', { name: 'get_execution', arguments: { executionId } });
    console.log(`--- poll ${poll} (HTTP ${statusRes.status}) ---`);
    console.log(statusRes.raw);
    if (statusRes.status !== 200) continue;
    finalRaw = statusRes.raw;
    const inner = parseJson(innerText(statusRes.raw));
    const completed = inner?.completed === true || inner?.status === 'completed' || inner?.status === 'success';
    const failed = inner?.failed === true || inner?.status === 'failed' || inner?.status === 'error';
    if (completed || failed) {
      terminal = true;
      break;
    }
  }

  if (!terminal) {
    console.log('\nRESULT: execution did not reach a terminal state within the poll budget. No transactionHash reported.');
    return;
  }

  console.log('\n========== STEP 3: final getExecution raw response ==========');
  const finalRes = await rpc('tools/call', { name: 'get_execution', arguments: { executionId } });
  console.log(`HTTP ${finalRes.status}`);
  console.log(finalRes.raw);

  const finalInner = parseJson(innerText(finalRes.raw));
  const hash = findString(finalInner, ['transactionHash', 'txHash']);
  console.log(`\ntransactionHash field in final raw response: ${hash === null ? 'NULL/ABSENT' : hash}`);
  if (hash) {
    console.log(`Explorer: https://sepolia.basescan.org/tx/${hash}`);
  } else {
    console.log('\nMEANING: the execution reached a terminal state but the response contains no transactionHash field —');
    console.log('the workflow is read-only or produced no on-chain tx. The write-workflow execution is NOT proven by this API response.');
  }
}

main().catch((err) => {
  console.error('\nUNEXPECTED ERROR:');
  console.error(err);
  process.exit(1);
});
