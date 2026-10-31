# Kerfvault: Live Demo Slice (about 50%)

A plan for taking the skeleton to a **live, working testnet demo** while deliberately leaving about half of the project unbuilt. It ends with seven agent prompts, one per phase.

---

## 1. What "50%" means here

"Percent complete" is fuzzy, so this plan defines it by **features**. The demo slice builds one thin path end to end: a shopper opens a book, goes offline, shows a voucher QR, a merchant verifies it offline, and later redeems it on-chain. Everything that makes the system resilient, safe for real money, or polished is left for the second half.

| Area | Built in the demo slice | Deferred (second half) |
|---|---|---|
| Voucher spec and vectors | Frozen v1 spec, real cross-language test vectors | Spec versioning and migration policy |
| Contract | `open_book`, `redeem`, getters, events, TTL extension inside those calls | `reclaim`, standalone `extend_ttl`, upgrade path |
| SDK | Encode, decode, sign, verify, client for open, redeem and read | Reclaim client, retry helpers, docs site |
| Indexer | Event polling, Postgres storage, full registry snapshot, resume after restart | Incremental snapshots, reorg handling, backfill, monitoring |
| Relay | `POST /redeem`, status lookup, simple rate limit, demo faucet | Abuse protection, fee budgeting, alerting |
| Shopper app | In-app testnet demo wallet, open book, voucher key, offline QR, book view | Freighter, reclaim UI, settings polish, scan-to-pay |
| Merchant reader | Address QR, registry sync, scan, offline verify, local queue, manual redeem | Background sync, auto-retry, merchant analytics |
| Quality | Unit tests, 3 end-to-end tests, CI green | Fuzzing, audit, bug bounty, accessibility audit, i18n |
| Release | Live testnet deployment, demo runbook, tag `v0.1.0-demo` | Mainnet, grants, docs site |

**Honest framing for your company:** this is a working testnet prototype of the core flow. It is not a product, and it must never hold real money. Say so on the demo screen and in the README.

---

## 2. Phase map

| Phase | Name | Maps to roadmap | Share of the slice | Ends with |
|---|---|---|---|---|
| S1 | Foundation, spec freeze, vectors, crypto | 1, part of 3 | 10% | Rust and TS agree byte for byte |
| S2 | Contract core | 2 | 20% | Contract tested and live on testnet |
| S3 | SDK client and CLI demo | 3 | 10% | Full loop runs from the command line |
| S4 | Indexer, relay, backend deploy | 4, 5 | 15% | Backend live on a host |
| S5 | Shopper app | 6 (partial) | 15% | Offline QR works on a phone, deployed |
| S6 | Merchant reader | 7 (partial) | 20% | Offline verify and redeem work, deployed |
| S7 | Integration, live demo, runbook | 8 (partial) | 10% | Tagged release and demo runbook |

---

## 3. How to use the prompts

1. **One phase per agent session.** Start a fresh session for each phase.
2. **Run S1 first.** It writes `docs/AGENT_RULES.md` and `docs/DEMO_SCOPE.md` into the repo, so every later session loads the same rules and scope from files instead of relying on chat history.
3. **Work on a branch** named in each prompt. Review, then merge to `main` yourself once CI is green.
4. **Approve the plan first.** Every prompt makes the agent show a short plan before writing files.
5. **Review gates.** Read the agent's work closely after **S1** (spec and vectors), **S2** (contract) and **S4** (relay). They are the security-sensitive pieces.
6. **You will need to do some steps by hand:** creating hosting accounts, pasting environment variables, and deploying. The agent produces checklists for those.
7. **If the agent stops midway,** reply "continue the same phase from where you stopped, and re-run the checks."
8. **After each phase,** tag the merge (`demo-s1`, `demo-s2`, ...) so you can roll back.

---

## 4. Prompts

> **Note:** These are the technical briefs for each phase. Branching, commits, pushing and merging are governed by `docs/PR_PLAN.md`, which overrides any `Branch:` line below. Save this file in your repo as `docs/DEMO_SLICE_PLAN.md`.

### S1: Foundation, spec freeze, test vectors, crypto

```markdown
# Phase S1: Foundation, spec freeze, vectors, crypto

Branch: phase/s1-foundation

## Context
Kerfvault is an offline-first voucher payment system on Stellar/Soroban. The skeleton monorepo exists and builds. We are now building a LIVE TESTNET DEMO covering about half the project, in seven phases (S1 to S7). This is phase S1.

## Step 0: Plan
Show a short plan and wait for my approval before writing files.

## Step 1: Write two files that every future session will read

Create docs/AGENT_RULES.md with this content (clean it up for readability, keep every rule):
- Read docs/DEMO_SCOPE.md before starting. Do only the current phase. Leave deferred items as todo!()/TODO stubs and keep them compiling.
- Testnet only. Hard-code a guard so the code refuses to run against any network passphrase other than testnet. Never add mainnet config.
- Never commit secrets, keys or real .env files. Secrets come from environment variables. Only throwaway test keys, clearly labelled, may appear in test vectors.
- Verify current docs and versions before using any Soroban, Stellar SDK, Next.js or library API. Do not invent API names. If unsure, leave a TODO with a docs link and tell me.
- Never hand-roll cryptography. Use a well-maintained library, preferring one already pulled in by the Stellar SDK.
- Run all checks before finishing: cargo fmt --check, cargo clippy -- -D warnings, cargo test, stellar contract build, pnpm -r lint, typecheck, test, build. Report real output; never claim a pass you did not run.
- Update docs/ARCHITECTURE.md and docs/THREAT_MODEL.md whenever behaviour changes.
- Add no new dependency without justifying it in the final report.
- Follow the PR workflow in docs/PR_PLAN.md: one branch and one commit per PR, the exact commit subject from the plan, no type prefix, no PR number. Where docs/PR_PLAN.md conflicts with a phase brief on commits, branches, pushing or merging, docs/PR_PLAN.md wins.
- If a decision affects security or money safety and the docs do not settle it, stop and ask me.
- Final report format: what changed, commands run with results, deviations from the prompt with reasons, new dependencies, open questions, remaining TODOs.

Create docs/DEMO_SCOPE.md with a table of what is BUILT in the demo slice versus DEFERRED:
- Built: frozen voucher spec and real vectors; contract open_book, redeem, getters, events, TTL extension inside those calls; SDK encode/decode/sign/verify plus client for open, redeem, read; indexer polling, Postgres, full registry snapshot, resume after restart; relay POST /redeem, status lookup, simple rate limit, DEMO_MODE faucet; shopper app with in-app testnet demo wallet, open book, voucher key, offline QR, book view; merchant reader with address QR, registry sync, scan, offline verify, local queue, manual redeem; three end-to-end tests; live testnet deployment; demo runbook.
- Deferred: reclaim, standalone extend_ttl, Freighter integration, incremental registry snapshots, reorg handling and backfill, background sync and auto-retry, advanced abuse protection and fee budgeting, scan-to-pay address, fuzzing, audit, mainnet.
Add a short "Phase status" checklist for S1 to S7.

## Step 2: Freeze the voucher spec
Finalize docs/VOUCHER_SPEC.md as v1:
- Fixed-width fields where possible; a version byte; a domain-separation tag that binds the contract ID; book ID, note index, merchant address, cap, accept_until.
- Resolve the open questions (merchant address encoding, byte order) and record each decision with a reason.
- Keep the QR payload size documented.
- Mark it v1 FROZEN.

## Step 3: Generate real test vectors
Write a deterministic generator script that replaces the placeholders in test-vectors/voucher.v1.json. Use fixed throwaway seeds labelled "TEST ONLY". Include: valid voucher; expired accept_until; tampered cap; tampered merchant; tampered note index; wrong contract ID; wrong book ID; corrupted signature; truncated payload; wrong version byte. Each vector records the expected result and the expected error.

## Step 4: Implement the crypto core on both sides
- TypeScript (packages/sdk): implement encodeVoucher, decodeVoucher, signVoucher, verifyVoucher (signature, expiry, cap). verifyVoucher must be a pure function that makes no network calls, and a test must prove it.
- Rust (contracts/kerfvault): implement voucher_message(...) as a pure function with no storage access.
- Both sides' tests read the SAME vectors. For every vector, the TypeScript and Rust message bytes must be identical, and every negative vector must be rejected.

## Done when
- Spec marked v1 FROZEN, both docs files exist, all checks pass.
- TS and Rust agree on every vector.
- Final report in the format from AGENT_RULES.md.
```

### S2: Contract core

```markdown
# Phase S2: Contract core

Branch: phase/s2-contract

Read docs/AGENT_RULES.md and docs/DEMO_SCOPE.md first. Show a short plan and wait for approval.

## Goal
Implement the real contract logic for the demo slice and deploy it to testnet.

## Build
- open_book(owner, token, voucher_key, denoms, redeem_deadline): owner authorizes; validate denominations; transfer the total from the owner into the contract (SEP-41 token interface); create notes; extend storage TTL for the book and notes; emit book_opened; return book_id.
- redeem(book_id, note_index, merchant, amount, cap, accept_until, signature): rebuild the message with voucher_message(); verify the ed25519 signature against the book's voucher key; require the note to be open; require amount <= cap and amount <= note denomination; pay the merchant; mark the note redeemed; return any leftover note value to the book's free balance; extend TTL; emit note_redeemed. Anyone may submit this call, since the merchant address is inside the signed message.
- get_book, get_note: read-only.
- Do NOT implement reclaim or the standalone extend_ttl. Keep them as todo!() stubs, still compiling, with a comment pointing at the roadmap.
- Check the redeem-time rules against the spec: the contract does NOT check accept_until against ledger time as a merchant-side rule unless docs/VOUCHER_SPEC.md says so. Follow the spec, and flag any inconsistency to me instead of guessing.

## Tests
- Unit tests for every error variant and every success path.
- Adversarial tests: wrong signature, signature for a different note, wrong merchant, wrong contract ID, double redeem, amount above cap, amount above note, nonexistent book or note.
- A test of the invariant: contract token balance == free balance + sum of open notes, checked after every operation in a sequence. Use property testing if it works with the Soroban test environment; otherwise use a thorough table-driven sequence test and say so.
- Use the Stellar Asset Contract in tests for the token (verify the current API).

## Testnet deployment
- Write scripts/deploy-testnet.sh using the Stellar CLI: create and fund throwaway identities (friendbot), create a test asset and deploy its Stellar Asset Contract, deploy the kerfvault contract.
- Write the resulting IDs (no secrets) to deployments/testnet.json and document them in docs/TOOLING.md.
- Run open_book and redeem against testnet with the CLI and include the real transaction hashes in the report.
- Measure resource use (CPU, memory, ledger entries, fees) for open_book and redeem and record it in docs/ARCHITECTURE.md.
- Note in the docs that a classic-asset recipient needs a trustline.

## Done when
All checks pass, the contract is live on testnet, one open_book and one redeem have been executed there, and the final report lists the transaction hashes.
```

### S3: SDK client and CLI demo

```markdown
# Phase S3: SDK client and CLI demo

Branch: phase/s3-sdk-cli

Read docs/AGENT_RULES.md and docs/DEMO_SCOPE.md first. Show a short plan and wait for approval.

## Goal
Make the whole loop work from the command line, with no UI.

## Build
- KerfvaultClient in packages/sdk: openBook, redeem, getBook, getNote, using the current @stellar/stellar-sdk and Soroban RPC (verify the API). Read network settings and contract IDs from config, defaulting to deployments/testnet.json. reclaim stays a TODO stub.
- A small CLI (packages/cli or scripts/demo, your choice; justify it) with commands: setup (create and fund demo accounts, add trustlines for the test asset, mint test balance), open-book, sign-voucher, verify (pure, offline, no network), redeem, show-book.
- Keys for the CLI come from local files or environment variables that are gitignored. Print only public keys.

## Tests
- Client tests against mocked RPC for encoding and error handling.
- One integration test, skipped unless an env flag is set, that runs the full flow on testnet.
- A test proving the verify command works with the network disabled.

## Docs
Add a "Run the demo from the command line" section to the README with a real terminal transcript of the full flow on testnet. A new developer must be able to reproduce it using the README alone.

## Done when
All checks pass and the README transcript was produced by actually running the commands.
```

### S4: Indexer, relay and backend deploy

```markdown
# Phase S4: Indexer, relay and backend deploy

Branch: phase/s4-backend

Read docs/AGENT_RULES.md and docs/DEMO_SCOPE.md first. Show a short plan and wait for approval. Dockerfiles are approved for this phase.

## Indexer (services/indexer)
- Poll Soroban RPC for kerfvault events from a stored cursor or ledger, and persist books and notes in Postgres. Finalize schema.sql with migrations.
- Resume correctly after a restart without duplicating rows (idempotent writes).
- GET /registry returns a full snapshot: contractId, asOfLedger, and for each book its id, voucher key, token, redeem deadline and each note's denomination and state. Keep it compact.
- GET /health includes the latest ledger processed and its lag.
- Document: public RPC providers keep limited event history, so the indexer must run continuously. Reorg handling, backfill and incremental snapshots are deferred; leave TODOs.

## Relay (services/relay)
- POST /redeem accepts the structured voucher fields (not raw transaction XDR). Validate with zod and enforce size limits. The relay builds the redeem transaction itself, calls ONLY the configured kerfvault contract's redeem function, simulates, signs with the fee account from the RELAY_SECRET environment variable, submits, and returns the transaction hash.
- GET /redeem/:hash returns status (pending, success, failed with reason).
- Simple in-memory per-IP rate limit; document its limits.
- DEMO_MODE=true only: POST /demo/faucet sends test funds and test asset to a given testnet address, strictly rate-limited. The faucet must not exist when DEMO_MODE is false.
- CORS allowlist from an environment variable.
- The relay must never be able to redirect funds. Add a test showing a modified merchant address fails signature verification in the contract.

## Deploy preparation
- Dockerfiles for both services, a render.yaml or equivalent for one hosting provider you recommend (check current free tiers and say why), .env.example files, and a local docker-compose for development.
- Produce docs/DEPLOY_BACKEND.md: a step-by-step checklist I can follow by hand (create the database, set environment variables, deploy, verify health), including how to fund the relay fee account on testnet.

## Done when
- All checks pass; the indexer syncs a real testnet book created with the CLI and /registry shows it; a redeem through the relay succeeds on testnet locally.
- docs/DEPLOY_BACKEND.md exists and is accurate.
- I will deploy it myself and tell you when it is live.
```

### S5: Shopper app

```markdown
# Phase S5: Shopper app (Kerf)

Branch: phase/s5-shopper-app

Read docs/AGENT_RULES.md and docs/DEMO_SCOPE.md first. Show a short plan and wait for approval.

## Decision for the demo
Use an in-app TESTNET demo wallet instead of Freighter, because Freighter is not practical on phones. Generate a keypair in the browser, store it encrypted with a user passcode (WebCrypto), and show a permanent banner: "Testnet demo. Test funds only." Freighter support is deferred. Create a browser-only shared package packages/web-wallet (key generation, encrypted storage, signing, network guard) that the merchant app will reuse in S6.

## Build apps/kerf
- Onboarding: create or unlock the wallet with a passcode; show the public address; "Get test funds" calls the relay's demo faucet.
- Open book: choose denominations and a redeem deadline; generate a SEPARATE voucher key (ed25519), stored encrypted; call openBook via the SDK; show progress and errors clearly.
- Book detail: read the book and note states from the chain; cache what is needed for offline use.
- Pay: pick a note, enter the merchant address (paste or type; scan-to-pay is deferred), set cap and accept_until, sign with the SDK, and display the voucher as a QR code.
- IMPORTANT: the Pay flow must work with the phone in airplane mode after the app has been used once online. Use a maintained service-worker approach compatible with Next.js 15 (check options, justify the choice) to cache the app shell and required routes, and keep the data needed to sign vouchers in local storage.
- Mobile-first layout, large tap targets, readable QR, clear loading and error states.
- Do not build reclaim UI or Freighter.

## Tests and deployment
- Component and unit tests for key storage (wrong passcode fails), voucher creation, and the testnet guard.
- A Playwright test (or documented manual test if Playwright is impractical) that loads the app, goes offline, and generates a voucher QR.
- Add vercel configuration and docs/DEPLOY_APPS.md with a manual checklist. The API URLs come from environment variables.

## Done when
All checks pass, the app is ready for me to deploy to Vercel, and an offline voucher can be generated and decoded back by the SDK in a test.
```

### S6: Merchant reader

```markdown
# Phase S6: Merchant reader

Branch: phase/s6-merchant-reader

Read docs/AGENT_RULES.md and docs/DEMO_SCOPE.md first. Show a short plan and wait for approval.

## Build apps/reader
- Setup: create or unlock the merchant's testnet demo wallet with packages/web-wallet; show the merchant address as text and as a QR; add the test asset trustline if missing (the payout would otherwise fail); show a testnet banner.
- Settings: maximum voucher amount accepted offline, stored locally.
- Registry sync: fetch /registry from the indexer, store it in IndexedDB, and show "last synced" with a warning when the data is old (choose a threshold and document it).
- Scan: use a maintained browser QR scanning library (check current options and justify), with a paste-payload fallback for desktop demos. Camera access needs HTTPS and permission handling.
- Offline verification pipeline using the SDK, run in this order, with a clear reason shown for each rejection: decode; version; signature against the voucher key from the registry; this merchant is the named payee; accept_until not passed; book and note exist in the registry and the note is open; cap and amount within the merchant's limit; the voucher has not already been accepted locally.
- Accepted vouchers go into a local queue (IndexedDB). A queue screen shows each voucher's status: accepted, redeeming, paid, failed with reason.
- "Redeem now" button (online only): send queued vouchers to the relay, show transaction hashes and status. Background sync and auto-retry are deferred.
- Mobile-first, large accepted/rejected result screens.

## Tests and deployment
- Unit tests for each verification step, including every rejection reason, using the shared test vectors.
- Test that verification works with the network disabled.
- A test that the same voucher scanned twice is rejected the second time.
- Add vercel configuration and extend docs/DEPLOY_APPS.md.

## Done when
All checks pass and a voucher generated by the shopper app can be verified offline by the reader and redeemed through the relay on testnet in a local run.
```

### S7: Integration, live demo and runbook

```markdown
# Phase S7: Integration, live demo and runbook

Branch: phase/s7-live-demo

Read docs/AGENT_RULES.md and docs/DEMO_SCOPE.md first. Show a short plan and wait for approval. I will have deployed the backend and both apps; the live URLs are: [PASTE URLs HERE].

## Build
- Check that the deployed apps and services are wired correctly: environment variables, CORS, the camera permission header, HTTPS, and the DEMO_MODE settings. Fix configuration issues in the repo and list any I must change in the host dashboards.
- Add a script to reset the demo state: fund fresh accounts and prepare a clean scenario.
- Add a short "How this demo works" page in each app in plain language, plus a visible list of limitations.
- Write 3 end-to-end tests with Playwright: (1) happy path: open a book, go offline, create a voucher, verify it offline, redeem it; (2) a tampered voucher is rejected offline; (3) a voucher presented twice is rejected the second time. They run against local services in CI.
- Update the README with a "Live demo" section: URLs, what it does, a table of what is built and what is deferred, and a clear testnet-only and unaudited warning.
- Add docs/DEMO_RUNBOOK.md: a five-minute demo script with exact steps, a pre-flight checklist (fund accounts, sync registry, charge phones, test camera, test airplane mode), a fallback plan if the network or camera fails (including a recorded backup video suggestion), and likely questions with honest answers.
- Update docs/ROADMAP.md: mark S1 to S7 complete and list the remaining second-half work, in order, from the deferred list.
- Prepare the release notes for v0.1.0-demo.

## Done when
All checks and the 3 end-to-end tests pass, the README and runbook are complete, and the final report includes a list of the deferred items turned into issue-ready descriptions.
```

---

## 5. Demo-day notes

- Run the full demo twice on the actual phones and network you will use, the day before.
- Keep a screen recording as a backup in case Wi-Fi or the camera fails.
- Say clearly what is deferred (reclaim, resilience, hardening, audit) and that the second half exists as a roadmap. A prototype presented honestly is more convincing than one that claims to be finished.
- Do not put real funds anywhere near it, and do not move it to mainnet before the hardening phase in the main roadmap.
