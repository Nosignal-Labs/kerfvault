# Agent Rules & Guidelines

This document defines the governing operational constraints, workflow conventions, and hard stops for all AI and automated agent sessions working in the Kerfvault codebase.

---

## 1. Hard stops

1. If any prerequisite fails (gh not authenticated, CI missing, branch protection blocking you, a tool not found), STOP and tell me. Do not use a workaround or fallback unless I write the exact words "fallback approved" in a message.
2. Never push to main. Never use --force, --no-verify, or --admin. Never edit git hooks or branch protection settings.
3. A starred PR is never merged by you. After opening it, stop and give me the review packet.
4. Never describe an earlier instruction as "previously approved" unless you can quote my exact words.
5. Before every push, run git branch --show-current and confirm it is not main.
6. If you are unsure whether something is allowed, ask.

---

## 2. PR Workflow Rules

1. One PR = one branch = one commit.
2. Branch named following the phase scheme `sN/short-slug` or descriptive topic.
3. Commit subject matching table, 72 characters or fewer, no manual PR number.
4. PR body with What / Why / How tested / Notes sections.
5. Squash merging allowed and required; watch CI until green before merging unstarred PRs.
