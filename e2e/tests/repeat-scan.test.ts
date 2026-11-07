import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  encodeVoucher,
  decodeVoucher,
  serializeCanonicalMessage,
  verifyVoucher,
  type OfflineVoucher,
} from "@kerfvault/sdk";

interface AcceptedRecord {
  id: string;
  status: string;
  acceptedAt: string;
}

function checkRepeatScan(
  bookId: bigint | string | number,
  noteIndex: number,
  acceptedList: AcceptedRecord[] | Set<string>
): { isRepeat: boolean; error?: string } {
  const targetId = `${bookId.toString()}:${noteIndex}`;
  if (acceptedList instanceof Set) {
    if (acceptedList.has(targetId)) {
      return {
        isRepeat: true,
        error: `Repeat scan refused: Voucher (${targetId}) has already been accepted on this terminal.`,
      };
    }
    return { isRepeat: false };
  }

  for (const item of acceptedList) {
    if (item.id === targetId && item.status !== "Rejected") {
      return {
        isRepeat: true,
        error: `Repeat scan refused: Voucher (${targetId}) has already been accepted on this terminal (${item.status}).`,
      };
    }
  }
  return { isRepeat: false };
}

describe("E2E Browser Test 3: Stop Repeated Scans Offline", () => {
  const CONTRACT_ID = "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE";
  let voucherKeypair: Keypair;
  let merchantKeypair: Keypair;

  let voucherNote0: OfflineVoucher;
  let wireNote0: string;
  let voucherNote1: OfflineVoucher;
  let wireNote1: string;

  beforeEach(() => {
    voucherKeypair = Keypair.random();
    merchantKeypair = Keypair.random();

    const bookId = 202n;
    const amount = 10_000_000n; // 1.0 XLM
    const cap = 10_000_000n;
    const acceptUntil = BigInt(Math.floor(Date.now() / 1000) + 86400);

    // Note Index 0
    const rawNote0: OfflineVoucher = {
      version: 1,
      contractId: CONTRACT_ID,
      bookId,
      noteIndex: 0,
      amount,
      cap,
      acceptUntil,
      merchant: merchantKeypair.publicKey(),
      signature: "",
    };
    const bytes0 = serializeCanonicalMessage(rawNote0);
    const sig0 = voucherKeypair.sign(Buffer.from(bytes0));
    voucherNote0 = { ...rawNote0, signature: Buffer.from(sig0).toString("hex") };
    wireNote0 = encodeVoucher(voucherNote0);

    // Note Index 1 (same book, different note)
    const rawNote1: OfflineVoucher = {
      version: 1,
      contractId: CONTRACT_ID,
      bookId,
      noteIndex: 1,
      amount,
      cap,
      acceptUntil,
      merchant: merchantKeypair.publicKey(),
      signature: "",
    };
    const bytes1 = serializeCanonicalMessage(rawNote1);
    const sig1 = voucherKeypair.sign(Buffer.from(bytes1));
    voucherNote1 = { ...rawNote1, signature: Buffer.from(sig1).toString("hex") };
    wireNote1 = encodeVoucher(voucherNote1);
  });

  it("accepts first scan, refuses repeat scan of identical voucher, and permits next distinct note", async () => {
    const acceptedRecords: AcceptedRecord[] = [];
    const voucherQueue: Array<{ id: string; voucher: OfflineVoucher }> = [];

    // Mock network to ensure zero requests happen
    const mockFetch = vi.fn().mockImplementation(() => {
      throw new Error("Zero network calls permitted during offline terminal operation");
    });
    vi.stubGlobal("fetch", mockFetch);

    // -------------------------------------------------------------
    // Step 1: Scan Voucher Note 0 for the first time
    // -------------------------------------------------------------
    const scanned0 = decodeVoucher(wireNote0);
    const repeatCheck0 = checkRepeatScan(scanned0.bookId, scanned0.noteIndex, acceptedRecords);
    expect(repeatCheck0.isRepeat).toBe(false);

    const verifyResult0 = await verifyVoucher(scanned0, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: merchantKeypair.publicKey(),
      voucherKey: voucherKeypair.publicKey(),
    });
    expect(verifyResult0.valid).toBe(true);

    // Terminal accepts Voucher Note 0
    const id0 = `${scanned0.bookId}:${scanned0.noteIndex}`;
    acceptedRecords.push({ id: id0, status: "AcceptedOffline", acceptedAt: new Date().toISOString() });
    voucherQueue.push({ id: id0, voucher: scanned0 });

    expect(acceptedRecords.length).toBe(1);
    expect(voucherQueue.length).toBe(1);

    // -------------------------------------------------------------
    // Step 2: Repeat scan of Voucher Note 0 (Replay Attack Attempt)
    // -------------------------------------------------------------
    const repeatScanned0 = decodeVoucher(wireNote0);
    const repeatCheckDuplicate = checkRepeatScan(
      repeatScanned0.bookId,
      repeatScanned0.noteIndex,
      acceptedRecords
    );

    // Terminal must identify repeat presentation and refuse it
    expect(repeatCheckDuplicate.isRepeat).toBe(true);
    expect(repeatCheckDuplicate.error).toContain("Repeat scan refused");
    expect(repeatCheckDuplicate.error).toContain("202:0");

    // Ensure duplicate is NOT added to accepted records or queue
    expect(acceptedRecords.length).toBe(1);
    expect(voucherQueue.length).toBe(1);

    // -------------------------------------------------------------
    // Step 3: Scan Voucher Note 1 from the same book (Legitimate Next Note)
    // -------------------------------------------------------------
    const scanned1 = decodeVoucher(wireNote1);
    const repeatCheck1 = checkRepeatScan(scanned1.bookId, scanned1.noteIndex, acceptedRecords);

    // Note 1 is fresh and must not be blocked by Note 0's presence
    expect(repeatCheck1.isRepeat).toBe(false);

    const verifyResult1 = await verifyVoucher(scanned1, {
      expectedContractId: CONTRACT_ID,
      merchantAddress: merchantKeypair.publicKey(),
      voucherKey: voucherKeypair.publicKey(),
    });
    expect(verifyResult1.valid).toBe(true);

    // Terminal accepts Voucher Note 1
    const id1 = `${scanned1.bookId}:${scanned1.noteIndex}`;
    acceptedRecords.push({ id: id1, status: "AcceptedOffline", acceptedAt: new Date().toISOString() });
    voucherQueue.push({ id: id1, voucher: scanned1 });

    expect(acceptedRecords.length).toBe(2);
    expect(voucherQueue.length).toBe(2);

    // -------------------------------------------------------------
    // Step 4: Re-attempt Note 0 after Note 1 was processed
    // -------------------------------------------------------------
    const replayNote0Again = checkRepeatScan(scanned0.bookId, scanned0.noteIndex, acceptedRecords);
    expect(replayNote0Again.isRepeat).toBe(true);
    expect(replayNote0Again.error).toContain("Repeat scan refused");

    // -------------------------------------------------------------
    // Step 5: Verify zero network calls were made
    // -------------------------------------------------------------
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
