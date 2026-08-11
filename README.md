# Sixa — x402 payment broker on KeeperHub

A Next.js broker that turns a plain-English goal into a paid-or-free KeeperHub
workflow call, pays via x402 v2 (ERC-20 USDC on Base), independently verifies the
on-chain receipt, and falls back to **generating a workflow** (AI → template →
programmatic) when no marketplace listing matches — pausing for explicit user
authorization before any fallback execution.

Built as a live demo of the KeeperHub API against real infrastructure:

### 🔗 Live On-Chain Proofs & Workflow Directory

#### Base Mainnet Real Transactions (`Chain ID 8453`)
* **Mainnet USDC Payment 1**: [`0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76`](https://basescan.org/tx/0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76) (Block #49801385, Status: Success)  
  * Target Listing: `Aave V3 Liquidation Risk Check — Base` (`wallet-snapshot-base` / ID: `r36u35fyn9i7gqu3f7phx`)  
  * KeeperHub Listing Link: [https://app.keeperhub.com/marketplace/wallet-snapshot-base](https://app.keeperhub.com/marketplace/wallet-snapshot-base)
* **Mainnet USDC Payment 2**: [`0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef`](https://basescan.org/tx/0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef) (Block #49801423, Status: Success)  
  * Target Listing: `Aave v3 Health Check` (`aave-v3-health-check` / ID: `f1rq5h53nwylfywdle3j7`)  
  * KeeperHub Listing Link: [https://app.keeperhub.com/marketplace/aave-v3-health-check](https://app.keeperhub.com/marketplace/aave-v3-health-check)

#### Base Sepolia Fallback Executions (`Chain ID 84532`)
* **Execution Tx 1**: [`0xd401a1d71927b896b55420c7bbbd37bf6e01d8d8316c9e36dd9d217351193e7d`](https://sepolia.basescan.org/tx/0xd401a1d71927b896b55420c7bbbd37bf6e01d8d8316c9e36dd9d217351193e7d) (Block #45354985, Status: Success)  
  * Generated Workflow ID: `lw33hb0ayj6gqintftq0q` (`checked-transfer-g63s`)  
  * KeeperHub Workflow Link: [https://app.keeperhub.com/workflows/lw33hb0ayj6gqintftq0q](https://app.keeperhub.com/workflows/lw33hb0ayj6gqintftq0q)
* **Execution Tx 2**: [`0x2b84b3bcb9c8cf4661d6834f0b00f9bcef3d4830fc2ec2d8e86e40db7272fde7`](https://sepolia.basescan.org/tx/0x2b84b3bcb9c8cf4661d6834f0b00f9bcef3d4830fc2ec2d8e86e40db7272fde7) (Block #45317577, Status: Success)  
  * Generated Workflow ID: `o96szqs3m261pw97v78sl`  
  * KeeperHub Workflow Link: [https://app.keeperhub.com/workflows/o96szqs3m261pw97v78sl](https://app.keeperhub.com/workflows/o96szqs3m261pw97v78sl)

## How it works

```
POST /api/broker/jobs  { message, budgetUsdc?, payMode }
   │
   ├─ intake        (LLM → goal, params, chainId; heuristics if LLM cold)
   ├─ discovery     (3 search_workflows passes → scored candidates)
   │
   ├─ best score ≥ 4  ──►  paid listing (x402 v2) / free listing
   │                        call → verify receipt/execution → completed
   │
   └─ best score < 4  ──►  generation fallback (free):
                           1. AI:  ai_generate_workflow (cold-start retry ×3)
                           2. Template: search_templates → deploy chain-matched,
                              executable template (skips tuple-arg ABIs and
                              unfunded ERC-20 transfers — checked via RPC)
                           3. Programmatic: web3/transfer-funds workflow on the
                              configured chain (native transfer from the org runner
                              — the transfer is the executed task action itself,
                              not a payment/fee; the fallback path is free)
                        → paused at awaiting_payment (authorization gate)
                        → POST /api/broker/jobs/:id/resume  (explicit approval)
                        → execute → verify via KeeperHub status → completed/verified
```

A job carries a `decisionRecord` (every discovery + generation call), an audit log,
a completion proof, and a human-readable report. Failures are recorded honestly —
a launched-but-unconfirmed execution is `unverified`, never a phantom success.

## Setup

1. Clone and install: `npm install`
2. Create `.env.local` (see below)
3. Run the dev server: `npm run dev -- -p 3211`

### Environment

| Variable | Purpose |
|----------|---------|
| `KEEPERHUB_API_KEY` | API key for the KeeperHub MCP endpoint |
| `KEEPERHUB_MCP_ENDPOINT` | Default `https://app.keeperhub.com/mcp` |
| `KEEPERHUB_CHAIN_ID` | Chain the broker operates on (`84532` = Base Sepolia) |
| `KEEPERHUB_ORG_RUNNER_ADDRESS` | Org wallet that executes workflows (runner) |
| `BROKER_PAYER_PRIVATE_KEY` | Wallet that pays x402 quotes |
| `BROKER_PAYER_CHAIN_ID` | Payer chain (`8453` mainnet / `84532` testnet) |
| `BROKER_PAYER_RPC_URL` | RPC for receipt verification (`https://sepolia.base.org`) |
| `OPENROUTER_API_KEY` | Intent parsing LLM |
| `AUTH_SECRET`, `SIXA_DECISION_SECRET` | Route/auth secrets |
| `SIXA_FALLBACK_RECIPIENT` | Fallback transfer destination (defaults to payer address) |
| `SIXA_FALLBACK_AMOUNT_ETH` | Fallback transfer amount (default `0.0001`) |

## API

- `POST /api/broker/jobs` — `{ message, budgetUsdc?, forcedSlug?, payMode: 'real'|'simulated'|'user' }`
- `GET /api/broker/jobs/:id` — job with decision, audit, execution, proof, report
- `GET /api/broker/jobs/:id/audit` — raw step trace
- `POST /api/broker/jobs/:id/resume` — authorize a paused fallback workflow
- `POST /api/broker/jobs/:id/payment` — `{ txHash, from? }` — confirm a user-made x402 payment for a paused paid listing

## Reproducing the demo runs

```bash
# 1. Dev server
npm run dev -- -p 3211

# 2. Precheck (deterministic path decision — prints score vs threshold)
npx tsx scripts/__precheck-demo-intent.ts

# 3. Run the fallback demo (gate → resume → terminal → trace saved)
npx tsx scripts/run-fallback-demo.ts 3211 <runId>

# 4. Verify the execution tx hash on-chain (sepolia.base.org)
npx tsx scripts/__verify-onchain.ts <runId>
```

Traces land in `results/fallback-run-<runId>.json`; summary + verification records
in `results/`. The full live-run report is `results/report-part1-part2.md`.

## Key source layout

- `src/lib/broker/pipeline.ts` — job lifecycle, discovery/selection, gates, verification
- `src/lib/broker/generate.ts` — fallback generation rungs (AI/template/programmatic)
- `src/lib/broker/client.ts` — KeeperHub MCP client (search, call, execute, deploy, create)
- `src/lib/broker/pay.ts` — x402 v2 payer + on-chain receipt verification (viem)
- `src/app/api/broker/jobs/...` — HTTP routes
- `scripts/` — demo drivers and probes
