-- Draft PostgreSQL Schema for Kerfvault Event Indexer

CREATE TABLE IF NOT EXISTS sync_state (
  key VARCHAR(64) PRIMARY KEY,
  last_ledger BIGINT NOT NULL,
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

CREATE TYPE note_state AS ENUM ('Open', 'Redeemed');

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

