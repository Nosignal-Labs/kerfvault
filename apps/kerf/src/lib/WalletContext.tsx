"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  hasStoredWallet,
  getStoredWallet,
  createAndStoreWallet,
  unlockStoredWallet,
  clearStoredWallet,
  type WalletSession,
} from "./wallet";
import {
  hasStoredVoucherKey,
  getStoredVoucherKey,
  mintAndStoreVoucherKey,
  unlockStoredVoucherKey,
  clearStoredVoucherKey,
} from "./voucherKey";
import { fetchAccountBalance, requestFaucetFunding } from "./faucet";

interface WalletContextValue {
  isLoaded: boolean;
  hasWallet: boolean;
  isUnlocked: boolean;
  publicKey: string | null;
  secret: string | null;
  voucherPublicKey: string | null;
  voucherSecret: string | null;
  hasVoucherKey: boolean;
  balance: string | null;
  isFunding: boolean;
  fundingMessage: string | null;
  error: string | null;
  createWallet: (passcode: string) => Promise<void>;
  unlockWallet: (passcode: string) => Promise<void>;
  mintVoucherKey: (passcode: string) => Promise<string>;
  lockWallet: () => void;
  resetWallet: () => void;
  clearError: () => void;
  requestFunds: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [hasVoucherKey, setHasVoucherKey] = useState(false);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [voucherSession, setVoucherSession] = useState<WalletSession | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingMessage, setFundingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!session?.publicKey) return;
    try {
      const bal = await fetchAccountBalance(session.publicKey);
      setBalance(bal);
    } catch {
      // Non-critical background balance fetch
    }
  }, [session?.publicKey]);

  // Sync with storage on mount
  useEffect(() => {
    try {
      const walletExists = hasStoredWallet();
      setHasWallet(walletExists);
      if (walletExists) {
        const stored = getStoredWallet();
        if (stored) {
          setSession({ publicKey: stored.publicKey, secret: "" });
        }
      }

      const voucherKeyExists = hasStoredVoucherKey();
      setHasVoucherKey(voucherKeyExists);
      if (voucherKeyExists) {
        const storedVoucher = getStoredVoucherKey();
        if (storedVoucher) {
          setVoucherSession({ publicKey: storedVoucher.publicKey, secret: "" });
        }
      }
    } catch (err) {
      console.error("Failed to read stored keys:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Update balance whenever public key changes
  useEffect(() => {
    if (session?.publicKey) {
      refreshBalance();
    } else {
      setBalance(null);
    }
  }, [session?.publicKey, refreshBalance]);

  const createWallet = useCallback(async (passcode: string) => {
    setError(null);
    try {
      const { session: newSession } = await createAndStoreWallet(passcode);
      setSession(newSession);
      setHasWallet(true);

      // Concurrently mint a separate, dedicated voucher signing key
      const { session: newVoucherSession } = await mintAndStoreVoucherKey(passcode);
      setVoucherSession(newVoucherSession);
      setHasVoucherKey(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create wallet.";
      setError(message);
      throw err;
    }
  }, []);

  const unlockWallet = useCallback(async (passcode: string) => {
    setError(null);
    try {
      const unlocked = await unlockStoredWallet(passcode);
      setSession(unlocked);

      // Also unlock voucher signing key if present; otherwise mint one
      if (hasStoredVoucherKey()) {
        const unlockedVoucher = await unlockStoredVoucherKey(passcode);
        setVoucherSession(unlockedVoucher);
        setHasVoucherKey(true);
      } else {
        const { session: mintedVoucher } = await mintAndStoreVoucherKey(passcode);
        setVoucherSession(mintedVoucher);
        setHasVoucherKey(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Incorrect passcode.";
      setError(message);
      throw err;
    }
  }, []);

  const mintVoucherKey = useCallback(async (passcode: string): Promise<string> => {
    setError(null);
    try {
      const { session: newVoucherSession } = await mintAndStoreVoucherKey(passcode);
      setVoucherSession(newVoucherSession);
      setHasVoucherKey(true);
      return newVoucherSession.publicKey;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to mint voucher key.";
      setError(message);
      throw err;
    }
  }, []);

  const lockWallet = useCallback(() => {
    if (session?.publicKey) {
      setSession({ publicKey: session.publicKey, secret: "" });
    } else {
      setSession(null);
    }
    if (voucherSession?.publicKey) {
      setVoucherSession({ publicKey: voucherSession.publicKey, secret: "" });
    } else {
      setVoucherSession(null);
    }
    setError(null);
  }, [session, voucherSession]);

  const resetWallet = useCallback(() => {
    clearStoredWallet();
    clearStoredVoucherKey();
    setSession(null);
    setVoucherSession(null);
    setHasWallet(false);
    setHasVoucherKey(false);
    setBalance(null);
    setFundingMessage(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const requestFunds = useCallback(async () => {
    if (!session?.publicKey) return;
    setIsFunding(true);
    setError(null);
    setFundingMessage(null);
    try {
      const res = await requestFaucetFunding(session.publicKey);
      setFundingMessage(res.message || "Funded successfully from testnet faucet.");
      await refreshBalance();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Faucet request failed";
      setError(message);
    } finally {
      setIsFunding(false);
    }
  }, [session?.publicKey, refreshBalance]);

  const isUnlocked = Boolean(
    session?.secret &&
    session.secret.length > 0 &&
    voucherSession?.secret &&
    voucherSession.secret.length > 0
  );

  return (
    <WalletContext.Provider
      value={{
        isLoaded,
        hasWallet,
        isUnlocked,
        publicKey: session?.publicKey ?? null,
        secret: session?.secret || null,
        voucherPublicKey: voucherSession?.publicKey ?? null,
        voucherSecret: voucherSession?.secret || null,
        hasVoucherKey,
        balance,
        isFunding,
        fundingMessage,
        error,
        createWallet,
        unlockWallet,
        mintVoucherKey,
        lockWallet,
        resetWallet,
        clearError,
        requestFunds,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
