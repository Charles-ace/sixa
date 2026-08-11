# KeeperHub API bounty — broker integration writeup

Project: **Sixa** — an x402 payment broker that pays for KeeperHub workflows on Base,
verifies receipts on-chain, and falls back to generating workflows when no listing
matches. This writeup summarizes what the integration exercise surfaced about the
public KeeperHub MCP surface (findings verified against the live API, not docs).

## Scope & method

- Paid path exercised on **Base mainnet** (`eip155:8453`) with USDC (x402 v2):
  - `0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76` is a Base mainnet USDC transfer, status success, at block 49801385.
  - `0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef` is a Base mainnet USDC transfer, status success, at block 49801423.
- Free fallback path exercised live on **Base Sepolia** (84532):
  - `0x5e0ebff7a2ccf90c987d58ec867e207f503f8861fa3a446a12aed4bb5e8648a5` is a Base Sepolia USDC transfer, status success, at block 45320348.
  - `0x2b84b3bcb9c8cf4661d6834f0b00f9bcef3d4830fc2ec2d8e86e40db7272fde7` is a Base Sepolia fallback execution, status success, at block 45317577.
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

### 9. Medium — a broker "payment" can confirm as a no-op while the app's own verification flags it correctly
Observed live: an x402 quote requested USDC on `eip155:8453` (Base mainnet), but the
broker broadcast from its configured testnet payer (Base Sepolia) using the quote's
mainnet USDC address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — an address with
**no contract code on Base Sepolia** (`eth_getCode` = `0x`, verified via RPC).
Both broadcast txs confirmed on-chain as status `success` at block 45337172 with
*gasUsed 22,460* and **zero Transfer logs** — a `transfer()` call against a
code-less address is a chain-level success that moves nothing:

- `0x774252404bd4dd89b0ca51a0e9aa23d0a181e4dfd48f8a38728dbca8dee4f3a6` — Sepolia, status=`0x1`, `to=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`, input=`0xa9059cbb` → payTo `0x21db...`, no logs.
- `0x11b13df57c07d638b43532a4cd4349556b9dc958d90a546a6bdee4cb4a2a9118` — Sepolia, status=`0x1`, input=`0xa9059cbb` → payTo `0xe20405...`, no logs.

Neither tx exists on Base mainnet. No USDC was debited (payer balance on the real
Sepolia USDC `0x036CbD...` is intact). The broker's `confirmOnChainReceipt` found
no Transfer event → correctly flagged `amount/recipient mismatch` → the paid
candidate failed honestly, no phantom success. **A payment tx can "succeed" on-chain
while carrying no settlement effect; independent receipt verification (event
decode + code-existence check) is what detects it.**

## Evidence artifacts

- `results/report-part1-part2.md` — full live-run report (mainnet receipts + 6 Sepolia runs)
- `results/fallback-run-{1..6}.json` — raw step traces (every HTTP call, audit, execution)
- `results/onchain-verification.json` — decoded on-chain verification of the 3 successful runs
- `sixa/src/lib/broker/generate.ts` — retry + chain-aware + executable-only fallback logic
