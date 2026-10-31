# Kerfvault PR Plan (demo slice, S1 to S7)

Save this file in the repo as `docs/PR_PLAN.md`. It lists **108 planned pull requests** across the seven demo-slice phases. Each PR is one small, reviewable change with its own commit message.

## 1. PR workflow rules

These rules override any conflicting instruction in a phase brief.

1. **One PR = one branch = one commit.** Branch name: `sN/short-slug` (for example `s2/open-book-funds`).
2. **Commit subject = the exact text in the tables below.** No type prefix, no trailing punctuation, 72 characters or fewer. Do not type a PR number into any commit subject or PR title yourself; GitHub is allowed to append PR numbers like `(#123)` on merge. A commit body is optional; if used, wrap at 72 characters and explain *why*.
3. **PR title = the same subject.** PR body has four short sections: What, Why, How tested, Notes.
4. **Merge method: "Squash and merge".** Squash merging is allowed and is the merge method to use (`gh pr merge --squash --delete-branch`). GitHub appends the PR number on merge.
5. **Main stays green.** Every PR must pass CI, and every deferred stub must still compile.
6. **Start the next PR only after the previous one is merged,** unless the maintainer says stacking is fine.
7. **Review gates (★).** After opening a ★ PR, stop and wait for the maintainer's review. Include a short review packet: the security assumptions, the tests that prove them, and what was not tested.
8. **No padding.** If a planned PR has too little real change for a reviewer to meaningfully check, say so and propose merging it into its neighbour. Do not invent filler changes to hit the count.
9. **Never push secrets.** Never run against any network other than testnet.

## 2. Batches

| Batch | PRs | Notes |
|---|---|---|
| B1 | S1-01 to S1-06 | Rules, scope, spec freeze |
| B2 | S1-07 to S1-14 | Vectors and crypto on both sides |
| B3 | S2-01 to S2-07 | Contract data model and open_book |
| B4 | S2-08 to S2-14 | redeem logic |
| B5 | S2-15 to S2-18 | Adversarial tests, invariant, testnet deploy |
| B6 | S3-01 to S3-06 | SDK client |
| B7 | S3-07 to S3-12 | CLI demo |
| B8 | S4-01 to S4-06 | Indexer |
| B9 | S4-07 to S4-12 | Relay core |
| B10 | S4-13 to S4-17 | Faucet, CORS, deploy prep. Maintainer deploys after. |
| B11 | S5-01 to S5-07 | Wallet and onboarding |
| B12 | S5-08 to S5-13 | Books and voucher QR |
| B13 | S5-14 to S5-16 | Offline cache and deploy prep. Maintainer deploys after. |
| B14 | S6-01 to S6-07 | Merchant setup and registry sync |
| B15 | S6-08 to S6-13 | Scanning and verification |
| B16 | S6-14 to S6-19 | Queue, redeem, deploy prep. Maintainer deploys after. |
| B17 | S7-01 to S7-06 | Live wiring and first browser test |
| B18 | S7-07 to S7-12 | Remaining tests, docs, release |

## 3. The PRs

★ marks a review gate. The commit subject column is verbatim.

### S1: Foundation, spec freeze, vectors, crypto (14 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S1-01 | Write the ground rules every agent session must follow | docs | |
| S1-02 | Record the demo scope as a built-versus-deferred table | docs | |
| S1-03 | Pin voucher field widths and byte order in the spec | docs | |
| S1-04 | Bind vouchers to their contract with a domain tag | docs | |
| S1-05 | Settle how merchant addresses are encoded on the wire | docs | |
| S1-06 | Freeze the voucher spec at version one | docs | ★ |
| S1-07 | Generate deterministic vectors from labelled test seeds | test-vectors, scripts | |
| S1-08 | Cover tampered, truncated and wrong-version payloads in vectors | test-vectors | |
| S1-09 | Encode and decode vouchers in the SDK | sdk | |
| S1-10 | Sign vouchers with a dedicated voucher key | sdk | |
| S1-11 | Verify signature, expiry and cap without touching the network | sdk | ★ |
| S1-12 | Prove verification stays offline with a no-network test | sdk tests | |
| S1-13 | Rebuild the signed message in Rust as a pure function | contract | |
| S1-14 | Make Rust and TypeScript agree byte for byte on every vector | contract, sdk tests | ★ |

### S2: Contract core (18 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S2-01 | Model books, notes and storage keys in the contract | contract | |
| S2-02 | Name every failure the contract can raise | contract | |
| S2-03 | Reject malformed denominations before any funds move | contract | |
| S2-04 | Open a book and pull the funds in from the owner | contract | |
| S2-05 | Emit an event whenever a book opens | contract | |
| S2-06 | Extend book and note lifetimes on every touch | contract | |
| S2-07 | Expose books and notes through read-only getters | contract | |
| S2-08 | Check voucher signatures against the book's voucher key | contract | |
| S2-09 | Pay the merchant when a valid voucher is redeemed | contract | ★ |
| S2-10 | Return unused note value to the book's free balance | contract | |
| S2-11 | Announce each redemption with an event for the indexer | contract | |
| S2-12 | Block a note from being redeemed twice | contract | ★ |
| S2-13 | Stop vouchers naming another merchant from paying out | contract | |
| S2-14 | Hold redemptions to the cap and the note value | contract | |
| S2-15 | Throw forged and cross-note signatures at the contract in tests | contract tests | |
| S2-16 | Assert the balance invariant after every operation | contract tests | ★ |
| S2-17 | Script the testnet deployment with funded throwaway identities | scripts, deployments | |
| S2-18 | Measure resource costs and publish the deployed contract IDs | docs, deployments | |

### S3: SDK client and CLI demo (12 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S3-01 | Load network settings and contract IDs from the deployment file | sdk | |
| S3-02 | Wrap contract reads in a typed client | sdk | |
| S3-03 | Dispatch open-book transactions through the client | sdk | |
| S3-04 | Route redemptions through the client | sdk | |
| S3-05 | Translate contract errors into readable SDK errors | sdk | |
| S3-06 | Scaffold the command-line demo package | cli | |
| S3-07 | Fund demo accounts and add trustlines from one setup command | cli | |
| S3-08 | Create a book from the terminal | cli | |
| S3-09 | Run voucher signing and checking offline from the terminal | cli | |
| S3-10 | Redeem a voucher and print the transaction hash | cli | |
| S3-11 | Gate the full testnet flow behind an opt-in integration test | cli, tests | |
| S3-12 | Walk through the demo in the README with a real transcript | docs | |

### S4: Indexer, relay and backend deploy prep (17 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S4-01 | Finalize the Postgres schema with migrations | indexer | |
| S4-02 | Poll Soroban RPC for contract events from a saved cursor | indexer | |
| S4-03 | Persist books and notes without duplicating rows on restart | indexer | |
| S4-04 | Serve the full registry snapshot over HTTP | indexer | |
| S4-05 | Report ledger lag on the indexer health endpoint | indexer | |
| S4-06 | Document the RPC history window and what is deferred | docs | |
| S4-07 | Validate redeem requests and cap their size | relay | |
| S4-08 | Build redeem transactions in the relay and never accept raw XDR | relay | ★ |
| S4-09 | Restrict the relay to one contract and one function | relay | ★ |
| S4-10 | Simulate, sign with the fee account and submit | relay | |
| S4-11 | Look up redemption status by transaction hash | relay | |
| S4-12 | Throttle callers with a per-IP limit | relay | |
| S4-13 | Stand up a demo-only faucet behind the DEMO_MODE flag | relay | |
| S4-14 | Allow only configured origins through CORS | relay, indexer | |
| S4-15 | Demonstrate that a tampered merchant address cannot redirect funds | relay tests | ★ |
| S4-16 | Package both services in Dockerfiles with a local compose file | infra | |
| S4-17 | Spell out the backend deploy steps in a checklist | docs | |

### S5: Shopper app (16 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S5-01 | Carve out a shared browser wallet package | web-wallet | |
| S5-02 | Encrypt the wallet key with a passcode via WebCrypto | web-wallet | ★ |
| S5-03 | Refuse any network other than testnet | web-wallet | |
| S5-04 | Create the onboarding screen for making and unlocking a wallet | apps/kerf | |
| S5-05 | Top up a new wallet from the demo faucet | apps/kerf | |
| S5-06 | Label every screen as testnet-only | apps/kerf | |
| S5-07 | Mint a separate voucher key and store it encrypted | apps/kerf | |
| S5-08 | Let shoppers choose denominations and a redeem deadline | apps/kerf | |
| S5-09 | Lock funds into a book from the browser and report progress | apps/kerf | |
| S5-10 | Load a book and its notes into the detail screen | apps/kerf | |
| S5-11 | Store what offline signing needs in local storage | apps/kerf | |
| S5-12 | Pick a note and set the payee, cap and expiry | apps/kerf | |
| S5-13 | Render a signed voucher as a QR code | apps/kerf | |
| S5-14 | Cache the app shell so payments work in airplane mode | apps/kerf | |
| S5-15 | Exercise the pay screen with the browser offline | apps/kerf tests | |
| S5-16 | Configure Vercel and note the shopper app deploy steps | infra, docs | |

### S6: Merchant reader (19 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S6-01 | Reuse the browser wallet in the merchant app | apps/reader | |
| S6-02 | Display the merchant address as text and as a QR code | apps/reader | |
| S6-03 | Detect a missing trustline and offer to add it | apps/reader | |
| S6-04 | Store the maximum offline voucher amount in settings | apps/reader | |
| S6-05 | Fetch the registry snapshot from the indexer | apps/reader | |
| S6-06 | Save the registry in IndexedDB with a last-synced stamp | apps/reader | |
| S6-07 | Warn when the registry has gone stale | apps/reader | |
| S6-08 | Scan voucher QR codes with the camera | apps/reader | |
| S6-09 | Accept pasted payloads for desktop demos | apps/reader | |
| S6-10 | Decode scanned vouchers and gate on the version byte | apps/reader | |
| S6-11 | Match the voucher signature to the registry's voucher key | apps/reader | ★ |
| S6-12 | Confirm this merchant is the named payee | apps/reader | |
| S6-13 | Reject expired vouchers and notes that are no longer open | apps/reader | |
| S6-14 | Hold every voucher to the merchant's own cap | apps/reader | |
| S6-15 | Remember accepted vouchers and refuse repeat scans | apps/reader | |
| S6-16 | Give accepted and rejected vouchers distinct result screens | apps/reader | |
| S6-17 | List the queue with a status for each voucher | apps/reader | |
| S6-18 | Send queued vouchers to the relay from a Redeem now button | apps/reader | |
| S6-19 | Extend the deploy notes with the reader's settings | docs | |

### S7: Integration, live demo and runbook (12 PRs)

| ID | Commit subject | Touches | Gate |
|---|---|---|---|
| S7-01 | Audit deployed environment variables and response headers | infra | |
| S7-02 | Permit camera access through a permissions header | infra | |
| S7-03 | Reset the demo to a clean state with one script | scripts | |
| S7-04 | Explain how the demo works inside each app | apps | |
| S7-05 | List known limitations on screen | apps | |
| S7-06 | Run the happy path from book to payout in a browser test | e2e | |
| S7-07 | Catch tampered vouchers offline in a second browser test | e2e | |
| S7-08 | Stop a repeated scan in a third browser test | e2e | |
| S7-09 | Describe the live demo, scope table and warnings in the README | docs | |
| S7-10 | Draft the demo runbook with a fallback plan | docs | |
| S7-11 | Update the roadmap with the second-half work | docs | |
| S7-12 | Tag the first demo release | release | |

## 4. Totals

| Phase | PRs |
|---|---|
| S1 | 14 |
| S2 | 18 |
| S3 | 12 |
| S4 | 17 |
| S5 | 16 |
| S6 | 19 |
| S7 | 12 |
| **Total** | **108** |

If a few PRs get merged into their neighbours under rule 8, the total will settle a little below 108. The plan leaves a buffer of 8 above 100 for that reason.
