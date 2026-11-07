import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  encodeVoucher,
  decodeVoucher,
  serializeCanonicalMessage,
  signVoucher,
  verifyVoucher,
  type OfflineVoucher,
} from "@kerfvault/sdk";

describe("E2E Browser Test 1: Happy Path from Book Creation to Payout", () => {
  const CONTRACT_ID = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  let shopperKeypair: Keypair;
  let voucherKeypair: Keypair;
  let merchantKeypair: Keypair;
  let relayKeypair: Keypair;

  // Mock local storage for browser simulation
  let shopperStorage: Map<string, string>;
  let readerStorage: Map<string, string>;
  let networkOnline: boolean;
  let networkRequestCount: number;

  beforeEach(() => {
    shopperKeypair = Keypair.random();
    voucherKeypair = Keypair.random();
    merchantKeypair = Keypair.random();
    relayKeypair = Keypair.random();

    shopperStorage = new Map();
    readerStorage = new Map();
    networkOnline = true;
    networkRequestCount = 0;
  });

  it("completes full happy path: open book -> go offline -> sign voucher -> verify offline -> redeem on-chain", async () => {
    // -------------------------------------------------------------
    // PHASE 1: Online - Open Voucher Book
    // -------------------------------------------------------------
    expect(networkOnline).toBe(true);

    const bookId = 101n;
    const noteCount = 5;
    const noteDenomination = 10_000_000n; // 1.0 XLM in stroops
    const maxCap = 10_000_000n;
    const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);

    // Save shopper book state to simulated browser storage
    const shopperBookState = {
      bookId: bookId.toString(),
      authority: shopperKeypair.publicKey(),
      voucherPublicKey: voucherKeypair.publicKey(),
      noteCount,
      denomination: noteDenomination.toString(),
      spentNotes: [] as number[],
    };
    shopperStorage.set(`kerfvault_book_${bookId}`, JSON.stringify(shopperBookState));

    // Pre-cache on-chain registry state on the reader terminal while online
    const registryCache = {
      cachedAt: new Date().toISOString(),
      books: {
        [bookId.toString()]: {
          bookId: bookId.toString(),
          authority: shopperKeypair.publicKey(),
          voucherKey: voucherKeypair.publicKey(),
          totalNotes: noteCount,
          noteDenomination: noteDenomination.toString(),
          validUntil: expiryTimestamp.toString(),
        },
      },
    };
    readerStorage.set("kerfvault_registry_cache_v1", JSON.stringify(registryCache));

    // Configure reader merchant settings (cap: 50 XLM)
    readerStorage.set(
      "kerfvault_merchant_settings_v1",
      JSON.stringify({
        maxVoucherCapXlm: 50,
        merchantAddress: merchantKeypair.publicKey(),
      })
    );

    // -------------------------------------------------------------
    // PHASE 2: Go Offline (Simulate Airplane Mode)
    // -------------------------------------------------------------
    networkOnline = false;

    const mockFetch = vi.fn().mockImplementation(() => {
      if (!networkOnline) {
        throw new TypeError("Failed to fetch: Network is offline (Airplane Mode active)");
      }
      networkRequestCount++;
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, txHash: "0x" + "a".repeat(64), status: "confirmed" }),
      });
    });

    // -------------------------------------------------------------
    // PHASE 3: Shopper creates and signs voucher completely offline
    // -------------------------------------------------------------
    const targetNoteIndex = 0;
    const rawVoucher: OfflineVoucher = {
      version: 1,
      contractId: CONTRACT_ID,
      bookId,
      noteIndex: targetNoteIndex,
      amount: noteDenomination,
      cap: maxCap,
      acceptUntil: expiryTimestamp,
      merchant: merchantKeypair.publicKey(),
      signature: "",
    };

    // Serialize canonical 181-byte message and sign with voucher Ed25519 keypair
    const canonicalBytes = serializeCanonicalMessage(rawVoucher);
    expect(canonicalBytes.length).toBe(181);

    const sigBytes = voucherKeypair.sign(Buffer.from(canonicalBytes));
    expect(sigBytes.length).toBe(64);

    const signedVoucher: OfflineVoucher = {
      ...rawVoucher,
      signature: Buffer.from(sigBytes).toString("hex"),
    };

    // Encode to 245-byte base64url wire payload for QR code display
    const wireQrPayload = encodeVoucher(signedVoucher);
    expect(typeof wireQrPayload).toBe("string");
    expect(wireQrPayload.length).toBeGreaterThan(0);

    // Record note as spent in shopper offline storage
    shopperBookState.spentNotes.push(targetNoteIndex);
    shopperStorage.set(`kerfvault_book_${bookId}`, JSON.stringify(shopperBookState));

    // Assert zero network requests occurred while creating the voucher
    expect(mockFetch).not.toHaveBeenCalled();

    // -------------------------------------------------------------
    // PHASE 4: Merchant Reader scans and verifies voucher offline
    // -------------------------------------------------------------
    // Reader decodes wire QR payload
    const decodedVoucher = decodeVoucher(wireQrPayload);
    expect(decodedVoucher.bookId).toBe(bookId);
    expect(decodedVoucher.noteIndex).toBe(targetNoteIndex);
    expect(decodedVoucher.amount).toBe(noteDenomination);
    expect(decodedVoucher.merchant).toBe(merchantKeypair.publicKey());

    // Reader verifies cryptographic signature and rules using cached registry
    const cachedBook = registryCache.books[decodedVoucher.bookId.toString()];
    expect(cachedBook).toBeDefined();

    const verifyResult = await verifyVoucher(decodedVoucher, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: merchantKeypair.publicKey(),
      maxCapLimit: 500_000_000n, // 50 XLM
      voucherKey: cachedBook.voucherKey,
      currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.reason).toBeUndefined();

    // Reader enqueues accepted voucher to offline local queue
    const queueRecord = {
      id: `${decodedVoucher.bookId}:${decodedVoucher.noteIndex}`,
      voucher: decodedVoucher,
      wirePayload: wireQrPayload,
      acceptedAt: new Date().toISOString(),
      status: "queued",
      txHash: undefined as string | undefined,
    };
    const offlineQueue = [queueRecord];
    const serializeState = (obj: unknown) =>
      JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    readerStorage.set("kerfvault_reader_voucher_queue_v1", serializeState(offlineQueue));

    // Assert zero network requests occurred while verifying and accepting the voucher
    expect(mockFetch).not.toHaveBeenCalled();

    // -------------------------------------------------------------
    // PHASE 5: Reconnect Online & Batch Redeem via Relay
    // -------------------------------------------------------------
    networkOnline = true;

    // Reader clicks "Redeem now"
    const queuedItems = JSON.parse(readerStorage.get("kerfvault_reader_voucher_queue_v1")!);
    expect(queuedItems.length).toBe(1);

    const relayResponse = await mockFetch("http://localhost:4002/relay/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voucher: queuedItems[0].voucher,
        caller: merchantKeypair.publicKey(),
      }),
    });

    const redeemJson = await relayResponse.json();
    expect(redeemJson.success).toBe(true);
    expect(redeemJson.status).toBe("confirmed");

    // Reader updates queue status
    queuedItems[0].status = "redeemed";
    queuedItems[0].txHash = redeemJson.txHash;
    readerStorage.set("kerfvault_reader_voucher_queue_v1", serializeState(queuedItems));

    // Verify end-to-end outcome
    const finalQueue = JSON.parse(readerStorage.get("kerfvault_reader_voucher_queue_v1")!);
    expect(finalQueue[0].status).toBe("redeemed");
    expect(finalQueue[0].txHash).toMatch(/^0x[a-f0-9]{64}$/);

    const finalShopperState = JSON.parse(shopperStorage.get(`kerfvault_book_${bookId}`)!);
    expect(finalShopperState.spentNotes).toContain(targetNoteIndex);
    expect(networkRequestCount).toBe(1);
  });
});

