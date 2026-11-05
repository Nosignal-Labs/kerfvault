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

interface WalletContextValue {
  isLoaded: boolean;
  hasWallet: boolean;
  isUnlocked: boolean;
  publicKey: string | null;
  secret: string | null;
  error: string | null;
  createWallet: (passcode: string) => Promise<void>;
  unlockWallet: (passcode: string) => Promise<void>;
  lockWallet: () => void;
  resetWallet: () => void;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const isUnlocked = Boolean(session?.secret && session.secret.length > 0);

  return (
    <WalletContext.Provider
      value={{
        isLoaded,
        hasWallet,
        isUnlocked,
        publicKey: session?.publicKey ?? null,
        secret: session?.secret || null,
        error,
        createWallet,
        unlockWallet,
        lockWallet,
        resetWallet,
        clearError,
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
