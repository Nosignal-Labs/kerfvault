-- Finalized PostgreSQL Schema for Kerfvault Event Indexer
-- Includes consolidated migrations 001 through 003

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_state (
  key VARCHAR(64) PRIMARY KEY,
  last_ledger BIGINT NOT NULL,
  cursor TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
  book_id BIGINT PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  owner VARCHAR(64) NOT NULL,
  token VARCHAR(64) NOT NULL,
  voucher_key VARCHAR(64) NOT NULL,
  redeem_deadline BIGINT NOT NULL,
  free_balance NUMERIC(39, 0) NOT NULL DEFAULT 0,
  created_ledger BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_books_owner ON books (owner);
CREATE INDEX IF NOT EXISTS idx_books_voucher_key ON books (voucher_key);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_state') THEN
    CREATE TYPE note_state AS ENUM ('Open', 'Redeemed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notes (
  book_id BIGINT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  note_index INT NOT NULL,
  denomination NUMERIC(39, 0) NOT NULL,
  state note_state NOT NULL DEFAULT 'Open',
  redeemed_merchant VARCHAR(64),
  redeemed_amount NUMERIC(39, 0),
  redeemed_ledger BIGINT,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (book_id, note_index)
);

CREATE INDEX IF NOT EXISTS idx_notes_state ON notes (book_id, state);

CREATE TABLE IF NOT EXISTS contract_events (
  id SERIAL PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL,
  topic VARCHAR(64) NOT NULL,
  ledger BIGINT NOT NULL,
  tx_hash VARCHAR(64),
  cursor TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_events_ledger ON contract_events (ledger);
CREATE INDEX IF NOT EXISTS idx_contract_events_topic ON contract_events (topic);
CREATE INDEX IF NOT EXISTS idx_contract_events_cursor ON contract_events (cursor);
