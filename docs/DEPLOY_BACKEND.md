# KerfVault Backend Deployment Checklist

This guide provides a manual step-by-step checklist for deploying and verifying the KerfVault backend infrastructure (`@kerfvault/indexer`, `@kerfvault/relay`, and PostgreSQL).

---

## 1. Prerequisites Checklist

- [ ] **Docker & Docker Compose** installed on the deployment host (or container hosting accounts on Railway, Fly.io, or Render).
- [ ] **Stellar Testnet Account** for the Relay fee payer with secret key (`S...`).
- [ ] **Stellar Testnet Contract ID**:
  ```text
  CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE
  ```
- [ ] **Soroban Testnet RPC URL**: `https://soroban-testnet.stellar.org`
- [ ] **Network Passphrase**: `Test SDF Network ; September 2015`

---

## 2. Relay Fee Account Funding

The redemption relay pays all Soroban gas and transaction fees on behalf of offline merchants. The relay account must be created and funded on Stellar testnet before starting the service.

### Step 2.1: Generate or Select a Relay Keypair

If you do not already have a dedicated testnet keypair for the relay:
```bash
# Using Stellar CLI or Node.js
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('RELAY_PUBLIC_KEY=' + kp.publicKey());
console.log('RELAY_SECRET=' + kp.secret());
"
```

### Step 2.2: Fund the Keypair via Friendbot

```bash
curl -X GET "https://friendbot.stellar.org?addr=<RELAY_PUBLIC_KEY>"
```

### Step 2.3: Confirm Account Balance

Verify that the account exists and holds testnet XLM:
```bash
curl -s "https://horizon-testnet.stellar.org/accounts/<RELAY_PUBLIC_KEY>" | grep -o '"balance":"[0-9.]*"'
```
Expected output: `"balance":"10000.0000000"`

---

## 3. Database Setup (PostgreSQL)

The indexer requires a PostgreSQL 15+ database to store contract events, synced ledger sequence, books, notes, and the full registry snapshot.

- [ ] **Provision Database**: Create a database named `kerfvault` on your PostgreSQL instance.
- [ ] **Connection String Format**:
  ```text
  postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/kerfvault?sslmode=require
  ```
- [ ] **Automated Migrations**: The indexer runs all migrations in `services/indexer/src/db/migrations/` automatically on service boot. Tables created:
  - `sync_state`
  - `books`
  - `notes`

---

## 4. Environment Variables Checklist

### Indexer (`services/indexer`)

| Variable | Description | Recommended Value |
|---|---|---|
| `PORT` | Listening HTTP port | `4001` |
| `DATABASE_URL` | Postgres connection string | `postgresql://...` |
| `RPC_URL` | Soroban Testnet RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NETWORK_PASSPHRASE` | Stellar network passphrase | `Test SDF Network ; September 2015` |
| `KERFVAULT_CONTRACT_ID` | Deployed contract ID | `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed web origins | `http://localhost:3000,http://localhost:3001,https://<shopper-domain>,https://<reader-domain>` |

### Relay (`services/relay`)

| Variable | Description | Recommended Value |
|---|---|---|
| `PORT` | Listening HTTP port | `4002` |
| `RPC_URL` | Soroban Testnet RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NETWORK_PASSPHRASE` | Stellar network passphrase | `Test SDF Network ; September 2015` |
| `KERFVAULT_CONTRACT_ID` | Deployed contract ID | `CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE` |
| `RELAY_SECRET` | 56-character secret key of fee account | `S...` |
| `DEMO_MODE` | Enables `POST /demo/faucet` endpoint | `true` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed web origins | `http://localhost:3000,http://localhost:3001,https://<shopper-domain>,https://<reader-domain>` |

---

## 5. Deployment Procedures

### Option A: Local or Single-Host Deployment (Docker Compose)

1. Clone repository to server:
   ```bash
   git clone https://github.com/Nosignal-Labs/kerfvault.git
   cd kerfvault
   ```
2. Create `.env` file with secrets:
   ```bash
   cat <<EOF > .env
   RELAY_SECRET=S...your-relay-secret...
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   EOF
   ```
3. Build and run containers in background:
   ```bash
   docker compose up -d --build
   ```
4. Verify all 3 containers are healthy:
   ```bash
   docker compose ps
   ```

### Option B: Cloud Container Deployment (Railway / Render / Fly.io)

1. **Deploy Postgres**: Create a managed PostgreSQL instance and copy the `DATABASE_URL`.
2. **Deploy Indexer**:
   - Docker context: root (`.`)
   - Dockerfile path: `services/indexer/Dockerfile`
   - Set environment variables as listed in Section 4.
3. **Deploy Relay**:
   - Docker context: root (`.`)
   - Dockerfile path: `services/relay/Dockerfile`
   - Set environment variables as listed in Section 4.

---

## 6. Verification and Health Check

Follow this checklist to confirm that the deployed backend is healthy and operating as expected:

### 1. Indexer Health & Lag
```bash
curl -i https://<INDEXER_HOST>/health
```
- [ ] Status code is `200 OK`.
- [ ] Response contains `"status": "ok"` and `"lag"`.

### 2. Registry Snapshot Endpoint
```bash
curl -i https://<INDEXER_HOST>/registry
```
- [ ] Status code is `200 OK`.
- [ ] Response contains `"version": 1` and `"contractId"`.

### 3. Relay Health
```bash
curl -i https://<RELAY_HOST>/health
```
- [ ] Status code is `200 OK`.
- [ ] Response contains `"status": "ok"`.

### 4. Relay Demo Faucet
```bash
curl -i -X POST https://<RELAY_HOST>/demo/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "GBYORV7UOSJQIJS4ADSER2UCR7ZNAAEOVUVCKBPWFG7RN5P2HXJCWNJK"}'
```
- [ ] Status code is `200 OK`.
- [ ] Response contains `"success": true`.

### 5. CORS Header Verification
```bash
curl -i -H "Origin: http://localhost:3000" https://<RELAY_HOST>/health
```
- [ ] Response contains `Access-Control-Allow-Origin: http://localhost:3000`.

---

## 7. CLI Demo Run against Live Backend

Once the checklist passes, verify the end-to-end workflow by running the CLI against the live services:

```bash
# Set endpoints to the live backend
export INDEXER_URL="https://<INDEXER_HOST>"
export RELAY_URL="https://<RELAY_HOST>"

# Run CLI verification loop
pnpm --filter @kerfvault/cli testnet-demo
```
