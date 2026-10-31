# Kerfvault Tooling & Prerequisites

This document lists the pinned versions of languages, runtimes, package managers, and development tools required to build, test, and run the Kerfvault monorepo.

---

## 1. Pinned Tool Versions

| Component | Pinned Version | Verification Source |
|---|---|---|
| **Rust Toolchain** | `1.99.1` (stable) | `rustc --version` |
| **Rust Target** | `wasm32v1-none` | Required for Soroban contracts on Rust $\ge$ 1.84 (replaces `wasm32-unknown-unknown`) |
| **Soroban SDK** | `28.0.0` | SDF official release (`crates.io/crates/soroban-sdk`) |
| **Stellar CLI** | `28.1.0` | SDF official release (`github.com/stellar/stellar-cli/releases`) |
| **Node.js** | `v24.18.0` | System LTS / active Node runtime (`node -v`) |
| **pnpm** | `12.16.1` | Global package manager (`pnpm -v`) |
| **Next.js** | `15.2.0` | App router framework for `@kerfvault/kerf` and `@kerfvault/reader` |
| **React** | `19.0.0` | React runtime |
| **TypeScript** | `5.7.3` | Monorepo typechecking engine |
| **tsup** | `8.4.0` | Bundler for `@kerfvault/sdk` |
| **Vitest** | `3.0.7` | Monorepo unit test runner |
| **Tailwind CSS** | `3.4.17` | Utility styling for apps |
| **Zod** | `3.24.2` | Runtime schema validation for `@kerfvault/relay` |

---

## 2. Installation Instructions

### 2.1 Rust and Target Setup

1. Install Rust via [rustup.rs](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Add the `wasm32v1-none` compilation target:
   ```bash
   rustup target add wasm32v1-none
   ```

### 2.2 Stellar CLI

Download and install Stellar CLI v28.1.0:
- **macOS / Linux**:
  ```bash
  cargo install --locked stellar-cli --version 28.1.0
  ```
- **Windows**:
  Download `stellar-cli-28.1.0-x86_64-pc-windows-msvc.tar.gz` from GitHub Releases, extract `stellar.exe`, and place it in your `PATH` (e.g. `%USERPROFILE%\.cargo\bin`).

Verify with:
```bash
stellar --version
# Output: stellar 28.1.0
```

### 2.3 Node.js & pnpm

1. Install Node.js (v20+ recommended, v24 supported).
2. Install pnpm:
   ```bash
   npm install -g pnpm@12.16.1
   ```

---

## 3. Quick Verification

To verify that your local environment is correctly configured:

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings
cargo test
stellar contract build

# JavaScript / TypeScript
pnpm install
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

