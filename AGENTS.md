# AGENTS.md

## Auto-Commit and Deploy Policy
- Always automatically commit and push verified code changes to `origin/master` as soon as type checks and builds pass.

## Vercel Blob Budget — MUST NOT REGRESS
The project's `sixa` blob store has been suspended once already for exhausting the free-tier **Blob Advanced Operations** quota (2K/month). Every `get`/`put`/`list`/`delete` on Vercel Blob counts toward it; **storage size is irrelevant**. A suspended store blocks ALL reads and writes.

Hard guardrails now enforced in `src/lib/broker/store.ts`:
- **Per-instance op budget (`chargeRemoteOp`, default 1000, env `BLOB_OP_BUDGET`)** — every remote blob call is charged; once the budget is spent, the store degrades to local-only mode (memory + `.data/broker-jobs.json`) and logs loudly. The app cannot exceed the quota, but excessive usage still degrades durability.
- **Coalesced writes (`flushSharedNow`)** — remote writes are batched to at most one write-set per 120s (snapshot + per-job files only for changed jobs; force-flush reserved for job creation).
- **Memory-first reads (`getJob`)** — the polling UI must never trigger blob reads; warm instances serve polls with zero ops. Never add `useCache: false` or force-fresh reads in request paths.

Rules for future changes:
1. Never call `blobGet`/`blobPut`/`blobList`/`blobDel` outside `src/lib/broker/store.ts`. If you add a new store function, route it through `chargeRemoteOp` and `writeChain`.
2. Never pass `true` to `listJobs()`/`loadSharedJobs()` from a request handler.
3. Keep client polls memory-only: client-side state (the polled job payload) is the source of truth for live UI, endpoints are for adoption/persistence.
4. Do not use `useCache: false` on blob reads — reads must go through the 2s TTL shared cache or memory.
5. If you genuinely need more quota, raise `BLOB_OP_BUDGET` only alongside a verified monthly op count that stays under 2K (check Vercel dashboard → Storage → Blob).
6. `scripts/blob-cleanup.ts` deletes legacy `sixa/snapshots/*` blobs in bulk (retention). Deletes count against the quota — run only in emergencies.

