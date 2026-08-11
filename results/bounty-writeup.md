# KeeperHub API bounty — broker integration writeup

Project: **Sixa** — an x402 payment broker that pays for KeeperHub workflows on Base,
verifies receipts on-chain, and falls back to generating workflows when no listing
matches. This writeup summarizes what the integration exercise surfaced about the
public KeeperHub MCP surface (findings verified against the live API, not docs).

## Scope & method

- Endpoint under test: `https://app.keeperhub.com/mcp` (MCP over JSON-RPC + SSE).
- Paid path exercised on **Base mainnet** (`eip155:8453`) with USDC (x402 v2):
  - Recorded, verified Base mainnet transactions (e.g. `0x5e0ebff7a2ccf90c987d58ec867e207f503f8861fa3a446a12aed4bb5e8648a5` at block 45320348).
- Free fallback path exercised live on **Base Sepolia** (84532) — 6 full broker runs (runs 4, 5, and 6 verified on-chain at blocks 45317391, 45317577, and 45317640), confirmed as valid transaction proof per KeeperHub clarification (Luca, Aug 11 in Discord).
- All 69 marketplace listings probed; catalog of 110 deployable templates inspected
  (deployed + node-config extraction).

## Findings (severity)

### 1. High — phantom "success" for executions with disabled write nodes
`get_execution` nests status as `status.status` and also returns `logs.completed`.
An execution whose write action node is disabled reports `completed=true`/`status=success`
with **zero** transaction hashes. A naive client reports a verified success with no
on-chain transaction. The broker detects this
(`hasWriteNodes && transactionHashes.length === 0 && !failed` → `phantom_success`)
and refuses to treat it as completion.
**Recommendation:** surface node `enabled` state and tx emission in the execution status,
or return an explicit `skipped` node state.

### 2. Medium — `upstream_cold_start` with no client-side retry story
`ai_generate_workflow` returns HTTP 200 with
`{"code":"upstream_cold_start","retryAfterSeconds":30,"hint":"Retry after 30 seconds. Pass idempotency_key on create_workflow..."}`
for long periods. A broker that treats this as an error silently loses the whole
generation path (we observed it for 60s+). Our fix: retry up to 3 times honoring
`retryAfterSeconds`, and pass an idempotency key on `create_workflow`.

### 3. Medium — template search ignores the query
`search_templates` returns the same ~110 templates in the same order for any query
("verify anchor commitment" and "defi" and nonsense queries all match). `templates[0]`
is always the "MEV Shield — private lane" template targeting ETH Sepolia (11155111).
Relevance scoring appears broken server-side.

### 4. Medium — node `network` is invisible before deploy
`search_templates` exposes each node's `actionType` only. The chain a template runs
on is only discoverable after `deploy_template` + `get_workflow`. A broker picking a
"matching" template can deploy a workflow on the wrong network and only learn at
execution time. Chain-filtering should exist in `search_templates`.

### 5. Medium — contract-node executor rejects tuple-argument ABIs
A DCA template calling Uniswap V3 `exactInputSingle` (tuple args) fails at execution
with `Invalid function arguments: params.tokenIn: address is missing` — the executor
flattens tuple fields. Templates validate (deploy succeeds) but can never execute.

### 6. Low — Code-action listing gated behind a paid plan
The `evoyield-sepolia-usdc-rebalancer` listing responds `402 upgrade_required` (Pro
plan). Reasonable, but the 402 came with no upgrade hint beyond the status.

### 7. Low — marketplace is mainnet-only
All 69 listings are `eip155:8453`; no testnet listing exists, so no testnet x402
payment can ever be exercised through the marketplace — testnet integrations must
use the fallback/generation path.

### 8. Info — native "transfer" executions route through a vault relayer
A `web3/transfer-funds` action executes via KeeperHub's relayer architecture:
- Top-level EVM transaction `From`: KeeperHub Relayer EOA (`0xdcf4bac4bd805948168ff63483bc493894a29613`), which signs and pays gas.
- Top-level EVM transaction `To`: KeeperHub Vault contract (`0x5af5194b4b0909eb978e3cf1e25333852277f07d`).
- Calldata decodes selector `0x9aefaff8` (`forward(runner, recipient, amountWei)`).
- **Internal Transactions:** Inside the execution call, the Vault calls the Org Runner Smart Wallet (`0xf3b2834b3f6fd105d3fcdb666f08b2e2dc2e0c61`), which executes an internal ETH call transfer (`CALL`) sending ETH directly from `0xf3b283...` to the recipient (`0xa8ee74...`). The runner wallet is debited on-chain via internal transaction. Verifiers should inspect internal transactions or input calldata decoding rather than assuming `0xf3b283...` appears as top-level `From`. Note this transfer is the
workflow action itself (source = org runner wallet, destination = the configured
recipient) — it is not a marketplace payment or a fee to KeeperHub.

## Evidence artifacts

- `results/report-part1-part2.md` — full live-run report (mainnet receipts + 6 Sepolia runs)
- `results/fallback-run-{1..6}.json` — raw step traces (every HTTP call, audit, execution)
- `results/onchain-verification.json` — decoded on-chain verification of the 3 successful runs
- `sixa/src/lib/broker/generate.ts` — retry + chain-aware + executable-only fallback logic
