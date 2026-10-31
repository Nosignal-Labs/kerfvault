# Contributing to Kerfvault

Thank you for your interest in contributing to Kerfvault! We are building an open-source, offline-first payment voucher infrastructure on Stellar and Soroban.

---

## 1. Getting Started & Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/kerfvault/kerfvault.git
   cd kerfvault
   ```
2. Ensure you have the required tool versions installed (see [docs/TOOLING.md](docs/TOOLING.md)):
   - Rust 1.84+ (stable) with target `wasm32v1-none`
   - Stellar CLI `v28.1.0`
   - Node.js `v20+` or `v24+`
   - pnpm `v12+` or `v9+`
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Copy environment example:
   ```bash
   cp .env.example .env
   ```

---

## 2. Picking an Issue

- Look for issues tagged `good first issue` or `wave_task`.
- Wave tasks follow the template in `.github/ISSUE_TEMPLATE/wave_task.md` with clearly defined Acceptance Criteria and Complexity ratings.
- Leave a comment stating you are working on the issue before submitting a PR.

---

## 3. Branch & Commit Guidelines

- **Branch naming**:
  - `feat/issue-number-short-description`
  - `fix/issue-number-short-description`
  - `docs/short-description`
- **Commit style**: Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(contract): implement open_book token transfer logic`
  - `fix(sdk): correct accept_until timestamp validation in verifyVoucher`
  - `docs(voucher): add base45 qr wire format details`

---

## 4. Running Tests Per Package

### Rust Soroban Contract
```bash
# Run unit tests
cargo test

# Check formatting and clippy
cargo fmt --check
cargo clippy -- -D warnings

# Build WASM artifact
stellar contract build
```

### TypeScript Packages & Apps
```bash
# SDK tests
pnpm --filter @kerfvault/sdk test

# Indexer tests
pnpm --filter @kerfvault/indexer test

# Relay tests
pnpm --filter @kerfvault/relay test

# Run all tests across the monorepo
pnpm -r test
```

---

## 5. Definition of Done (DoD)

Before requesting a review, verify that:
1. All existing and new tests pass locally (`cargo test` and `pnpm -r test`).
2. Lint and format checks pass cleanly without warnings (`cargo clippy -- -D warnings` and `pnpm -r lint`).
3. TypeScript typechecking succeeds (`pnpm -r typecheck`).
4. Monorepo builds completely without errors (`stellar contract build` and `pnpm -r build`).
5. No credentials, secret keys, or testnet secrets are committed to git.
6. Documentation is updated to reflect any protocol or API changes.

---

## 6. Security Reporting

Please do **NOT** file public GitHub issues for security vulnerabilities. Review our [SECURITY.md](SECURITY.md) for private disclosure instructions.

