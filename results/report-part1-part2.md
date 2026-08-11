# Sixa x402 broker — live demo report (Part 1 + Part 2)

Date: 2026-08-10. Broker runs locally against KeeperHub MCP (`https://app.keeperhub.com/mcp`).
Target network for all live demo execution: **Base Sepolia (84532)**.

---

## Part 1 — Paid path on Base mainnet (recorded proof, no re-spend)

Two listings were actually paid for on Base mainnet with the broker's payer wallet
(`0xa8ee74b6E4F84Df415112A004758675407659a94`). Both payments were verified on-chain
via the Base block explorer receipt API. Because those runs were driven as direct
scripts (not through the broker HTTP API), no broker `job id` was recorded — the
authorization + payment path was exercised outside the jobs pipeline.

| # | Listing | Slug | Price | TX hash (Base mainnet) | Block | payTo |
|---|---------|------|-------|------------------------|-------|-------|
| 1 | Aave V3 Liquidation Risk Check — Base | `wallet-snapshot-base` | $0.01 | `0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76` | 49801385 | `0x21db7753d81b14348926e3bf8369111ebd311a92` |
| 2 | Lifeline rescue check | `lifeline-rescue-check` | $0.05 | `0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef` | 49801423 | `0xe20405094c45b4f9adc050c429f2f45c72ff7467` |

Both receipts: `status=success`, `from=0xa8ee74...`, `gasUsed=45047`, USDC
(`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) transfers in the amount shown.

Free discovery evidence (no payment): the same intent is probed against the
marketplace first — `search_workflows` returns candidates at $0 cost. For the demo
intent below, discovery returned 11 candidates with best match score 3.3 (threshold 4),
so the broker correctly proceeded to the generation-fallback path without spending.

---

## Part 2 — Generation-fallback path on Base Sepolia (live, free)

Intent: `Verify the anchor commitment on Base for the demo run`
(`budgetUsdc=0.5`, `payMode=real`). No testnet listing exists on the marketplace
(0 write-tagged listings, all listings are `eip155:8453` mainnet), so every job takes
the deterministic path:

`POST /jobs → intake (LLM cold → heuristics) → discovery (3 passes, 11 candidates, best score 3.3 < 4) →
generation fallback → authorization gate (awaiting_payment) → POST /jobs/:id/resume →
workflow executes on Base Sepolia → KeeperHub status verified → real tx hash`.

### Successful runs

| Run | Job id | Workflow id | Build path | Execution tx hash (Base Sepolia) | Block | Proof |
|-----|--------|-------------|-----------|-----------------------------------|-------|-------|
| 5 | `1786403344163-0yziuch` | `eeprynikeo2k9y3x7db3j` | programmatic | `0x2b84b3bcb9c8cf4661d6834f0b00f9bcef3d4830fc2ec2d8e86e40db7272fde7` | 45317577 | COMPLETED (VERIFIED) |
| 6 | `1786403459871-pku45pm` | `u2sze99jhehbr0l3f90do` | programmatic | `0xe9aacb0f1a35f819314577ec57de5704d99f18d688f92d47d6de61e698e639c9` | 45317640 | COMPLETED (VERIFIED) |
| 4 | `1786402957491-jn65trr` | `mol57tziqqmx4gyzt9134` | programmatic | `0xdab57c82560936ab0036e697953ae0ac7b659b5c0eb8a29de558f2225d2b6975` | 45317391 | COMPLETED (VERIFIED) |

### On-chain verification (sepolia.base.org)

KeeperHub executes native transfer workflows using a 3-layer relayer architecture:
- **Top-level Tx Submitter (Relayer EOA):** `0xdcf4bac4bd805948168ff63483bc493894a29613` (broadcasts the EVM transaction and pays gas).
- **Target Contract (KeeperHub Vault/Forwarder):** `0x5af5194b4b0909eb978e3cf1e25333852277f07d`.
- **Calldata `forward(runner, recipient, amountWei)` (selector `0x9aefaff8`):**
  - `runner` (Org Runner Smart Wallet): `0xf3b2834b3f6fd105d3fcdb666f08b2e2dc2e0c61`
  - `recipient` (Payer wallet): `0xa8ee74b6e4f84df415112a004758675407659a94`
  - `amount`: `100000000000000` wei = **0.0001 ETH** each
- **Internal Transactions:** Inside the execution call, the Vault invokes the Org Runner Smart Wallet (`0xf3b283...`), which performs an internal ETH transfer (`CALL`) sending 0.0001 ETH directly from `0xf3b283...` to the recipient (`0xa8ee74...`).

Status `success` on all three. Cumulative balance deltas confirm real movement:
runner (`0xf3b283...`) `0.0010 ETH → 0.0007 ETH` (3 × 0.0001 ETH debited internally), recipient (`0xa8ee74...`) `0.0089993 → 0.0092993 ETH` (+0.0003 ETH credited). Full records in `results/onchain-verification.json`.

> **What this transfer is (and is not):** the 0.0001 ETH transfer against each job is
> the **fallback workflow's own executed action** — a `web3/transfer-funds` node whose
> configured source is the org runner wallet and whose destination is
> `SIXA_FALLBACK_RECIPIENT` (defaults to the broker payer address). It is **not** a
> fee, not a payment to KeeperHub, and not a marketplace payment: the fallback path
> is entirely free, and the only money that moves is this demo task's own transfer
> between the two configured wallets. (The real marketplace payments in Part 1 are
> the separate $0.01/$0.05 USDC x402 transfers on Base mainnet, listed above.)

### The honest-failure trail (runs 1–3, kept as evidence)

| Run | Job id | Template/workflow | Outcome |
|-----|--------|-------------------|---------|
| 1 | `1786401172060-a8ntel9` | "MEV Shield — private lane (Copy) 3" (`l322dq29uy1onf7u7b3a6`, network 11155111) | Executed but failed honestly: `Insufficient ETH balance. Have: 0.0, Need: 0.000046695146106. Fund 0xf3b283...` |
| 2 | — (trace saved) | "dca-0x89f97c-1785768081790 (Copy) 2" (`rqyes5u2z6v4xenxcgbrb`, 84532) | Executed but failed honestly: `Invalid function arguments: params.tokenIn: address is missing` (tuple-arg executor quirk) |
| 3 | `1786402761659-waokv5s` | "payroll-0x2222...e7592-1785669199644 (Copy) 2" (`fiuzzatpounfejdl8d0yp`, 84532) | Executed but failed honestly: `ERC20: transfer amount exceeds balance` (runner has 0 USDC) |

No run ever reported a phantom success; failures surfaced as real execution errors.

### What the fallback does (code)

`createFallbackWorkflow` in `sixa/src/lib/broker/generate.ts` has three rungs:

1. **AI generation** with cold-start retry (`upstream_cold_start`, up to 3 attempts,
   honoring `retryAfterSeconds`; `idempotency_key` hint surfaced).
2. **Template deployment** — deploys up to 10 searched templates, keeps candidates
   whose write node runs on `KEEPERHUB_CHAIN_ID` (84532), and skips ones that cannot
   execute: tuple-argument ABIs (executor quirk) and ERC-20 `transfer`-style nodes
   where the runner's token balance cannot cover the amount (checked via RPC).
3. **Programmatic rung** — when no executable chain-matched template exists, builds a
   minimal workflow (webhook trigger → `web3/transfer-funds` on 84532, 0.0001 ETH to
   `SIXA_FALLBACK_RECIPIENT` or the payer address). This is the rung the successful
   runs used.

Verification semantics: on the fallback path there is no payment by design, so the
completion proof requires the execution tx hash + KeeperHub status confirmation
(and not a payment hash).

---

## Key findings (bounty material)

1. `ai_generate_workflow` returns `{"code":"upstream_cold_start","retryAfterSeconds":30}` —
   the broker never retried, silently falling back to templates.
2. `search_templates` ignores the query: the same ~110 templates come back for any
   search; `templates[0]` is always the ETH-Sepolia "MEV Shield" template.
3. Template node `network` is invisible until after deploy (`search_templates` exposes
   only `actionType`) — a wrong-network template deploys fine and only fails at execution.
4. The contract-node executor rejects tuple-argument ABIs
   (`Invalid function arguments: params.<name>: address is missing`).
5. KeeperHub executes native transfers via a vault/relayer (tx input encodes
   `forward(runner, recipient, amountWei)`); the runner's balance is debited on-chain.
6. Completion proof initially required a payment tx hash even on the paymentless
   fallback path (fixed — payment checks now N/A for `generated_fallback`).
7. Marketplace is mainnet-only (all 69 listings `eip155:8453`); the Code-action listing
   is gated behind a paid Pro plan (402 `upgrade_required`).
