#!/usr/bin/env bash
set -euo pipefail

# Guard: strictly Testnet only
NETWORK="testnet"
EXPECTED_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="https://soroban-testnet.stellar.org"

# Locate stellar CLI
STELLAR_BIN="${STELLAR_BIN:-stellar}"
if ! command -v "$STELLAR_BIN" &> /dev/null; then
  if [ -f "$HOME/.cargo/bin/stellar.exe" ]; then
    STELLAR_BIN="$HOME/.cargo/bin/stellar.exe"
  elif [ -f "$HOME/.cargo/bin/stellar" ]; then
    STELLAR_BIN="$HOME/.cargo/bin/stellar"
  else
    echo "Error: stellar CLI not found in PATH or ~/.cargo/bin" >&2
    exit 1
  fi
fi

echo "==> Using Stellar CLI: $STELLAR_BIN"
"$STELLAR_BIN" --version

# Create output dir
mkdir -p deployments

DEPLOYER_ALIAS="kv_testnet_deployer"
ISSUER_ALIAS="kv_testnet_issuer"
MERCHANT_ALIAS="kv_testnet_merchant"

echo "==> Generating and funding throwaway identities via Friendbot..."
"$STELLAR_BIN" keys generate "$DEPLOYER_ALIAS" --fund --network "$NETWORK" --overwrite
"$STELLAR_BIN" keys generate "$ISSUER_ALIAS" --fund --network "$NETWORK" --overwrite
"$STELLAR_BIN" keys generate "$MERCHANT_ALIAS" --fund --network "$NETWORK" --overwrite

DEPLOYER_ADDR=$("$STELLAR_BIN" keys address "$DEPLOYER_ALIAS")
ISSUER_ADDR=$("$STELLAR_BIN" keys address "$ISSUER_ALIAS")
MERCHANT_ADDR=$("$STELLAR_BIN" keys address "$MERCHANT_ALIAS")

echo "Deployer address: $DEPLOYER_ADDR"
echo "Issuer address:   $ISSUER_ADDR"
echo "Merchant address: $MERCHANT_ADDR"

ASSET_CODE="KVUSD"
ASSET_ID="${ASSET_CODE}:${ISSUER_ADDR}"

echo "==> Deploying Stellar Asset Contract (SAC) for ${ASSET_ID}..."
SAC_CONTRACT_ID=$("$STELLAR_BIN" contract asset deploy \
  --asset "$ASSET_ID" \
  --source-account "$DEPLOYER_ALIAS" \
  --network "$NETWORK" \
  --cost)

echo "SAC Contract ID: $SAC_CONTRACT_ID"

echo "==> Building and optimizing Kerfvault contract WASM..."
"$STELLAR_BIN" contract build --package kerfvault-contract

WASM_PATH="target/wasm32v1-none/release/kerfvault_contract.wasm"

echo "==> Deploying Kerfvault contract to Testnet..."
KERFVAULT_CONTRACT_ID=$("$STELLAR_BIN" contract deploy \
  --wasm "$WASM_PATH" \
  --source-account "$DEPLOYER_ALIAS" \
  --network "$NETWORK" \
  --cost)

echo "Kerfvault Contract ID: $KERFVAULT_CONTRACT_ID"

# Native SAC address for XLM on testnet
NATIVE_SAC_ID=$("$STELLAR_BIN" contract id asset --asset native --network "$NETWORK")
echo "Native SAC ID: $NATIVE_SAC_ID"

cat <<EOF > deployments/testnet.json
{
  "network": "testnet",
  "rpcUrl": "${RPC_URL}",
  "networkPassphrase": "${EXPECTED_PASSPHRASE}",
  "contracts": {
    "kerfvault": "${KERFVAULT_CONTRACT_ID}",
    "testAssetSac": "${SAC_CONTRACT_ID}",
    "nativeSac": "${NATIVE_SAC_ID}"
  },
  "asset": {
    "code": "${ASSET_CODE}",
    "issuer": "${ISSUER_ADDR}",
    "id": "${ASSET_ID}"
  },
  "accounts": {
    "deployer": "${DEPLOYER_ADDR}",
    "issuer": "${ISSUER_ADDR}",
    "merchant": "${MERCHANT_ADDR}"
  }
}
EOF

echo "==> Testnet deployment completed successfully. Saved to deployments/testnet.json"

