# Sixa — x402 payment broker on KeeperHub

A Next.js broker that turns a plain-English goal into a paid-or-free KeeperHub
workflow call, pays via x402 v2 (ERC-20 USDC on Base), independently verifies the
on-chain receipt, and falls back to **generating a workflow** (AI → template →
programmatic) when no marketplace listing matches — pausing for explicit user
authorization before any fallback execution.

Built as a live demo of the KeeperHub API against real infrastructure:
- **Marketplace Payment Leg Proof:** Proven by recorded, verified Base mainnet USDC transactions (`0x5e0ebff7a2ccf90c987d58ec867e207f503f8861fa3a446a12aed4bb5e8648a5` at block 45320348).
- **Live Demo & Repeatable Proof:** Operating on the Base Sepolia fallback-generation path, explicitly confirmed as acceptable proof for hackathon submissions per KeeperHub clarification (Luca, Aug 11 in Discord).

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
