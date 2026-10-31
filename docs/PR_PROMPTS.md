# Kerfvault: Prompts for Building the Demo Slice PR by PR

Use these with `PR_PLAN.md` (108 PRs, 18 batches) and `DEMO_SLICE_PLAN.md` (the technical brief for each phase).

---

## 1. One-time setup (you do this by hand)

### 1.1 Put the planning documents in the repo

```bash
cd kerfvault
mkdir -p docs
cp /path/to/PR_PLAN.md docs/PR_PLAN.md
cp /path/to/kerfvault-demo-slice-plan.md docs/DEMO_SLICE_PLAN.md
git add docs/PR_PLAN.md docs/DEMO_SLICE_PLAN.md
git commit -m "Seed the planning documents for the demo slice"
git remote add origin <your-repo-url>
git push -u origin main
```

Do this **before** turning on branch protection, since this commit goes straight to `main`.

### 1.2 GitHub repo settings

1. **Settings > General > Pull Requests:** tick *Allow squash merging*, tick *Automatically delete head branches*.
2. **Why:** Squash merging is allowed and is the merge method to use. GitHub appends the PR number like "(#123)" to the commit message on merge (no manual PR numbers in commit subjects or PR titles).
3. **Branch protection on `main`:** require a pull request, require the CI checks to pass, require linear history.
4. Make sure your CI workflows run on pull requests.

### 1.3 Optional: let the agent open PRs

Install the GitHub CLI and log in yourself. The agent never handles your credentials.

```bash
gh auth login
gh auth status
```

If you skip this, the agent leaves each branch ready and gives you the PR title and body to paste.

---

## 2. The batch prompt (reuse for every batch)

Fill in the three placeholders in braces, then paste it as the first message of a **fresh agent session**.

```
Execute batch {BATCH} of the Kerfvault demo slice: PRs {FIRST} to {LAST} from docs/PR_PLAN.md.

Read first:
- docs/AGENT_RULES.md (if it exists yet) and docs/DEMO_SCOPE.md (if it exists yet)
- docs/PR_PLAN.md: the workflow rules and the PR table
- the {PHASE} brief in docs/DEMO_SLICE_PLAN.md for the technical detail
If the brief and docs/PR_PLAN.md disagree about commits, branches, pushing or merging, docs/PR_PLAN.md wins.

Step 0: Show me a plan listing, for each PR in the batch: the branch name, the files you expect to touch, and how you will test it. Wait for my approval.

Then, for each PR in order:
1. Branch from an up-to-date main.
2. Make only the change the PR's subject describes. Leave deferred items as compiling stubs.
3. Run the checks for the area you touched and fix any failure.
4. Make ONE commit. The subject must be exactly the text in the PR table: no prefix, no PR number, no trailing punctuation.
5. {PR_MODE}
6. {MERGE_MODE}
7. If the PR is marked with a star, stop after opening it and give me a review packet: the security assumptions, the tests that prove them, and what you did not test. Wait for my reply.

If a PR would be too small for a reviewer to check meaningfully, tell me and propose merging it into its neighbour. Do not add filler changes to hit the count.

After the last PR in the batch, run the full check suite (cargo fmt --check, cargo clippy -- -D warnings, cargo test, stellar contract build, pnpm -r lint, typecheck, test, build) and report using the format in docs/AGENT_RULES.md, plus a table of: PR ID, branch, commit subject, checks run, result. Use only real command output.
```

### Fill-ins

**{PR_MODE}** (pick one):

- With GitHub CLI: `Push the branch and open a PR titled with the same subject, with sections What, Why, How tested, Notes.`
- Without it: `Do not push. Leave the branch ready and give me the PR title and body to paste.`

**{MERGE_MODE}** (pick one):

- Safest: `Do not merge. I will merge each PR myself with Squash and merge after CI is green.`
- Faster: `Once CI is green, merge non-star PRs yourself using squash merge (gh pr merge --squash --delete-branch). Never merge a star PR; wait for me.`

---

## 3. Batch table (what to fill in)

| Batch | {BATCH} | {FIRST} to {LAST} | {PHASE} | Special instructions to add at the end of the prompt |
|---|---|---|---|---|
| 1 | B1 | S1-01 to S1-06 | S1 | "In S1-01, docs/AGENT_RULES.md must include the PR workflow rules from docs/PR_PLAN.md instead of any Conventional Commits rule." |
| 2 | B2 | S1-07 to S1-14 | S1 | none |
| 3 | B3 | S2-01 to S2-07 | S2 | none |
| 4 | B4 | S2-08 to S2-14 | S2 | "Check the spec before deciding whether the contract enforces accept_until; flag any inconsistency to me." |
| 5 | B5 | S2-15 to S2-18 | S2 | "Include the real testnet transaction hashes in the report." |
| 6 | B6 | S3-01 to S3-06 | S3 | none |
| 7 | B7 | S3-07 to S3-12 | S3 | "The README transcript must come from actually running the commands." |
| 8 | B8 | S4-01 to S4-06 | S4 | none |
| 9 | B9 | S4-07 to S4-12 | S4 | "The relay builds transactions itself and never accepts raw XDR." |
| 10 | B10 | S4-13 to S4-17 | S4 | "Dockerfiles are approved for this batch." |
| 11 | B11 | S5-01 to S5-07 | S5 | "Use an in-app testnet demo wallet, not Freighter." |
| 12 | B12 | S5-08 to S5-13 | S5 | none |
| 13 | B13 | S5-14 to S5-16 | S5 | "Check current service-worker options for Next.js 15 and justify the choice." |
| 14 | B14 | S6-01 to S6-07 | S6 | none |
| 15 | B15 | S6-08 to S6-13 | S6 | "Check current QR scanning libraries and justify the choice." |
| 16 | B16 | S6-14 to S6-19 | S6 | none |
| 17 | B17 | S7-01 to S7-06 | S7 | "The live URLs are: [paste them here]." |
| 18 | B18 | S7-07 to S7-12 | S7 | none |

**Pauses that need you:**
- After **B10**: deploy the backend using the checklist from S4-17, then confirm the CLI demo works against the live services before B11.
- After **B13**: deploy the shopper app to Vercel.
- After **B16**: deploy the merchant reader to Vercel.
- Before **B17**: have all live URLs ready.

---

## 4. Review-gate prompt

When the agent stops at a star PR, you can reply with this if its packet is thin:

```
Before I review this PR, give me a review packet:
1. Every security assumption this change relies on, one line each.
2. For each assumption, the exact test that would fail if it stopped being true.
3. Anything you did not test, and why.
4. The three places in the diff where a mistake would be most costly, with file and line.
5. Anything in docs/VOUCHER_SPEC.md or docs/THREAT_MODEL.md that this change makes out of date.
```

Always read the diff of star PRs yourself. Don't approve them from the agent's summary alone.

---

## 5. Repair prompts

**CI failed:**

```
CI failed on this PR. Read the failing job's log, tell me the root cause in plain words, fix it with a new commit on the same branch (do not rewrite history unless I say so), and re-run the checks. If the failure points at an earlier merged PR, tell me before touching it.
```

**The agent drifted from the plan:**

```
Stop. Compare what you changed against the PR's subject in docs/PR_PLAN.md. List anything outside that scope. Revert it from this branch, and put each item on a list of follow-ups for me instead.
```

**The agent stopped midway:**

```
Continue batch {BATCH} from the last unmerged PR. First run git status and git log to confirm where we are, re-run the checks, and then carry on with the same rules.
```

**The commit subject was wrong:**

```
The commit subject for {ID} must be exactly: "{SUBJECT}". Amend this branch's single commit to match, with no prefix and no PR number, and show me git log -1.
```

---

## 6. End-of-phase routine

After the last PR of a phase is merged, run these yourself:

```bash
git checkout main && git pull
git tag demo-s1          # demo-s2, demo-s3, ... for each phase
git push origin demo-s1
```

Then update the checklist in `docs/DEMO_SCOPE.md`, or ask the agent to do it as a small PR using the next phase's first batch.

---

## 7. Progress tracker

| Phase | PRs | Done | Tag |
|---|---|---|---|
| S1 | 14 | | demo-s1 |
| S2 | 18 | | demo-s2 |
| S3 | 12 | | demo-s3 |
| S4 | 17 | | demo-s4 |
| S5 | 16 | | demo-s5 |
| S6 | 19 | | demo-s6 |
| S7 | 12 | | v0.1.0-demo |
| **Total** | **108** | | |

---

## 8. Before you apply to Drips Wave

- Check the program's current rules on AI-assisted contributions and disclose the use of AI assistance in your README if required or advisable.
- A PR history of small, honest, reviewable changes is a strength. A history padded with trivial changes is not, so follow rule 8 in `docs/PR_PLAN.md`.
