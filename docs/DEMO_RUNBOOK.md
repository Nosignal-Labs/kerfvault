# Kerfvault Live Demonstration Runbook

> **Standard Operating Procedure, Pre-Flight Checklist & Fallback Plan**  
> Target Duration: 5 Minutes | Environment: Stellar Testnet

---

## 1. Executive Summary

This runbook guides presenters through the end-to-end live demonstration of KerfVault: opening an escrow voucher book on Stellar/Soroban, severing all network connectivity, signing and scanning an offline payment voucher between two phones, and settling funds on-chain through a fee-paying relay once reconnected.

---

## 2. Pre-Flight Checklist (T-15 Minutes)

Complete every item in this checklist prior to beginning the live presentation:

- [ ] **1. Clean Demo State & Fund Testnet Accounts**:
  Run the automated demo reset script from the workspace root:
  ```bash
  pnpm reset-demo
  ```
  This creates fresh throwaway keypairs for the Shopper, Merchant, and Relay, and requests 10,000 XLM from Stellar Friendbot.
- [ ] **2. Verify Services & Endpoints**:
  Ensure both backend services and frontend PWAs are accessible:
  - Shopper App: `http://localhost:3000` (or deployed Vercel URL)
  - Reader App: `http://localhost:3001` (or deployed Vercel URL)
  - Relay Gateway: `http://localhost:4002/health`
  - Indexer Service: `http://localhost:4001/health`
- [ ] **3. Pre-Sync Reader Registry Snapshot**:
  Open the Reader App while online, navigate to `/settings`, and tap **"Sync Registry Now"**. Confirm that the latest book registry snapshot is saved to local storage.
- [ ] **4. Verify Camera Permissions**:
  Open `http://localhost:3001/scan` on the reader device and grant camera permissions (`Permissions-Policy: camera=(self)`). Ensure the camera preview renders smoothly.
- [ ] **5. Device Battery & Screen Brightness**:
  Set the shopper phone screen brightness to $\ge 85\%$ to ensure instant QR code recognition under stage lighting. Both devices must have $\ge 50\%$ battery charge.
- [ ] **6. Airplane Mode Dry Run**:
  Toggle Airplane Mode on the shopper phone and verify that the Service Worker serves the PWA shell without network error screens.

---

## 3. 5-Minute Live Demo Script

| Elapsed | Stage | Presenter Actions & Verbal Cue | Audience Experience |
|---|---|---|---|
| **0:00 - 1:00** | **Intro & Book Escrow** | • Introduce the problem: crypto fails without active internet (flights, festivals, disaster zones).<br>• On Shopper App (Online): Tap **"Open New Book"**.<br>• Deposit 50 XLM (5 notes of 10 XLM each). Tap **"Confirm Escrow"**. | Audience sees on-chain Soroban contract transaction locking funds into Book #101 on Stellar Testnet. |
| **1:00 - 1:45** | **Going Dark (Airplane Mode)** | • Announce: *"Now, we are entering total network blackout."*<br>• Visibly toggle **Airplane Mode** on both the Shopper phone and the Merchant terminal.<br>• Confirm Wi-Fi, Cellular, and Bluetooth are disabled. | Visible offline badge activates on both device headers. No internet packets can leave or enter. |
| **1:45 - 2:45** | **Offline Voucher Signing** | • On Shopper App: Navigate to **"Pay"**.<br>• Select unspent Note #0 (10 XLM).<br>• Enter/select Merchant address.<br>• Tap **"Generate Voucher"**.<br>• App signs 245-byte payload with Ed25519 voucher key in pure browser memory. | High-density QR code renders instantly on shopper phone screen. |
| **2:45 - 3:45** | **Offline Scan & Verify** | • On Merchant Reader: Open **"Scan"** camera.<br>• Point merchant camera at shopper QR code.<br>• Terminal evaluates 5 cryptographic rules locally against cached snapshot.<br>• Result screen turns green: **"Voucher Accepted Offline"**.<br>• *(Optional quick demo)*: Re-scan the same QR code $\to$ Immediate red screen: **"Repeat scan refused"**. | Instant offline verification in $<15$ milliseconds with zero network requests. Goods can be safely handed over. |
| **3:45 - 5:00** | **Reconnection & Payout** | • Toggle **Airplane Mode OFF** on Merchant phone.<br>• Navigate to **"Vouchers"** queue.<br>• Tap **"Redeem Now"**.<br>• Relay submits transaction to Stellar Testnet, paying network gas.<br>• Terminal displays confirmed transaction hash. | On-chain settlement finalized on Stellar. Merchant balance reflects payout, shopper's used note is closed. |

---

## 4. Fallback & Incident Response Procedures

If unexpected issues occur during live presentations, immediately apply the relevant fallback:

### Fallback A: Venue Camera Glare or Low Light
- **Symptom**: The camera scanner cannot focus on the shopper phone screen due to stage lighting or glare.
- **Resolution**:
  1. On the Shopper App, tap **"Copy Wire Payload"** under the QR code.
  2. On the Merchant Reader, tap the **"Paste Payload"** tab on `/scan`.
  3. Paste the 245-byte base64url string and tap **"Verify Voucher"**.
  4. The terminal executes the exact same offline cryptographic verification pipeline.

### Fallback B: Flaky Venue Wi-Fi or Hotspot Failure
- **Symptom**: Initial book opening or final relay redemption hangs due to venue network interference.
- **Resolution**:
  - Run the demo locally on `localhost` using the monorepo dev servers:
    ```bash
    pnpm --filter @kerfvault/kerf dev &
    pnpm --filter @kerfvault/reader dev &
    pnpm --filter @kerfvault/relay start &
    ```
  - Both frontend apps are local PWAs and interact seamlessly over local loopback.

### Fallback C: Stellar Testnet Network Congestion
- **Symptom**: Soroban testnet ledger ingestion is degraded or Friendbot is rate-limiting.
- **Resolution**:
  - Use pre-funded accounts generated by `pnpm reset-demo --dry-run`.
  - Point the relay and indexer to local standalone mock mode (`DEMO_MODE=true`).

### Fallback D: Total Device Failure
- **Symptom**: A device battery dies or phone display breaks on stage.
- **Resolution**:
  - Keep a pre-recorded 60-second screen capture video of the complete two-phone offline payment in your presentation slides or local desktop folder.

---

## 5. Likely Questions & Honest Answers

### Q1: How does this prevent double-spending between different merchants offline?
> **Honest Answer**: In this v1 demo slice, offline double-spending between two separate offline merchants is prevented by merchant-configured risk caps. Because neither merchant is connected to the internet, neither knows what the other has accepted until settlement. Phase 2 introduces on-chain fraud challenge arbitration, collateral slashing, and deposit clawbacks to mathematically disincentivize offline multi-merchant double spending.

### Q2: Who pays the transaction gas fees for redemption?
> **Honest Answer**: In our live demo, the KerfVault fee-paying relay sponsors Soroban network gas fees so merchants do not need testnet XLM reserves. In production, redemptions can be sponsored by the relay, paid by the merchant, or settled through an account abstraction paymaster.

### Q3: Can I run this on mainnet today?
> **Honest Answer**: Absolutely not. KerfVault is an unaudited experimental prototype deployed strictly to Stellar Testnet. Mainnet deployment requires external smart contract audits, formal cryptographic verification, and hardware enclave integration.

### Q4: What tokens and currencies are supported?
> **Honest Answer**: Any asset compliant with the Stellar Asset Contract (SAC) standard, including native XLM and fiat-backed stablecoins such as USDC.
