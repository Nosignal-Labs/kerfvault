"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  hasStoredMerchantWallet,
  getStoredMerchantWallet,
  createAndStoreMerchantWallet,
  importAndStoreMerchantWallet,
  unlockStoredMerchantWallet,
  clearStoredMerchantWallet,
  type WalletSession,
} from "./merchantWallet";

interface MerchantWalletContextValue {
  isLoaded: boolean;
  hasWallet: boolean;
  isUnlocked: boolean;
  merchantAddress: string | null;
  secret: string | null;
  error: string | null;
  createWallet: (passcode: string) => Promise<void>;
  importWallet: (secretKey: string, passcode: string) => Promise<void>;
  unlockWallet: (passcode: string) => Promise<void>;
  lockWallet: () => void;
  resetWallet: () => void;
  clearError: () => void;
}

const MerchantWalletContext = createContext<MerchantWalletContextValue | undefined>(undefined);

export function MerchantWalletProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [merchantAddress, setMerchantAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync stored state on mount
  useEffect(() => {
    try {
      const exists = hasStoredMerchantWallet();
      setHasWallet(exists);
      if (exists) {
        const stored = getStoredMerchantWallet();
        if (stored?.publicKey) {
          setMerchantAddress(stored.publicKey);
        }
      }
    } catch {
      // noop
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const createWallet = useCallback(async (passcode: string) => {
    setError(null);
    try {
      const { session: newSession } = await createAndStoreMerchantWallet(passcode);
      setSession(newSession);
      setMerchantAddress(newSession.publicKey);
      setHasWallet(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create merchant wallet.";
      setError(message);
      throw err;
    }
  }, []);

  const importWallet = useCallback(async (secretKey: string, passcode: string) => {
    setError(null);
    try {
      const { session: newSession } = await importAndStoreMerchantWallet(secretKey, passcode);
      setSession(newSession);
      setMerchantAddress(newSession.publicKey);
      setHasWallet(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to import merchant wallet.";
      setError(message);
      throw err;
    }
  }, []);

  const unlockWallet = useCallback(async (passcode: string) => {
    setError(null);
    try {
      const unlocked = await unlockStoredMerchantWallet(passcode);
      setSession(unlocked);
      setMerchantAddress(unlocked.publicKey);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Incorrect passcode.";
      setError(message);
      throw err;
    }
  }, []);

  const lockWallet = useCallback(() => {
    setSession(null);
  }, []);

  const resetWallet = useCallback(() => {
    clearStoredMerchantWallet();
    setSession(null);
    setMerchantAddress(null);
    setHasWallet(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: MerchantWalletContextValue = {
    isLoaded,
    hasWallet,
    isUnlocked: session !== null,
    merchantAddress: session?.publicKey || merchantAddress,
    secret: session?.secret || null,
    error,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    resetWallet,
    clearError,
  };

  return (
    <MerchantWalletContext.Provider value={value}>
      {children}
    </MerchantWalletContext.Provider>
  );
}

export function useMerchantWallet(): MerchantWalletContextValue {
  const ctx = useContext(MerchantWalletContext);
  if (!ctx) {
    throw new Error("useMerchantWallet must be used within a MerchantWalletProvider");
  }
  return ctx;
}

