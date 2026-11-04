-- Migration 003: Contract events audit log

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
