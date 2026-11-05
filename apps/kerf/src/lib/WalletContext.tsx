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
import { fetchAccountBalance, requestFaucetFunding } from "./faucet";

interface WalletContextValue {
  isLoaded: boolean;
  hasWallet: boolean;
  isUnlocked: boolean;
  publicKey: string | null;
  secret: string | null;
  balance: string | null;
  isFunding: boolean;
  fundingMessage: string | null;
  error: string | null;
  createWallet: (passcode: string) => Promise<void>;
  unlockWallet: (passcode: string) => Promise<void>;
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
  const [session, setSession] = useState<WalletSession | null>(null);
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
      const exists = hasStoredWallet();
      setHasWallet(exists);
      if (exists) {
        const stored = getStoredWallet();
        if (stored) {
          // Address can be previewed even when locked
          setSession({ publicKey: stored.publicKey, secret: "" });
        }
      }
    } catch (err) {
      console.error("Failed to read stored wallet:", err);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Incorrect passcode.";
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
    setError(null);
  }, [session]);

  const resetWallet = useCallback(() => {
    clearStoredWallet();
    setSession(null);
    setHasWallet(false);
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

  const isUnlocked = Boolean(session?.secret && session.secret.length > 0);

  return (
    <WalletContext.Provider
      value={{
        isLoaded,
        hasWallet,
        isUnlocked,
        publicKey: session?.publicKey ?? null,
        secret: session?.secret || null,
        balance,
        isFunding,
        fundingMessage,
        error,
        createWallet,
        unlockWallet,
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
