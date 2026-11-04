-- Migration 002: Add cursor tracking to sync_state for Soroban RPC event pagination

ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS cursor TEXT;
