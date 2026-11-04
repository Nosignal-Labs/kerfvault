import type { QueryResultRow } from "pg";

export interface Queryable {
  query: <R extends QueryResultRow = any>(text: string, values?: unknown[]) => Promise<{ rows: R[] }>;
}

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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
    `,
  },
  {
    id: 2,
    name: "002_add_cursor_to_sync_state",
    sql: `
      ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS cursor TEXT;
    `,
  },
  {
    id: 3,
    name: "003_contract_events_audit",
    sql: `
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
    `,
  },
];

export async function initMigrationTable(client: Queryable): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function getAppliedMigrations(client: Queryable): Promise<string[]> {
  await initMigrationTable(client);
  const result = await client.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY id ASC;"
  );
  return result.rows.map((row) => row.name);
}

export async function getPendingMigrations(
  client: Queryable,
  migrations: Migration[] = MIGRATIONS
): Promise<Migration[]> {
  const applied = new Set(await getAppliedMigrations(client));
  return migrations
    .filter((m) => !applied.has(m.name))
    .sort((a, b) => a.id - b.id);
}

export async function runMigrations(
  client: Queryable,
  migrations: Migration[] = MIGRATIONS
): Promise<string[]> {
  await initMigrationTable(client);
  const pending = await getPendingMigrations(client, migrations);
  const applied: string[] = [];

  for (const migration of pending) {
    await client.query("BEGIN;");
    try {
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1);", [migration.name]);
      await client.query("COMMIT;");
      applied.push(migration.name);
    } catch (err) {
      await client.query("ROLLBACK;");
      throw new Error(`Failed to apply migration '${migration.name}': ${(err as Error).message}`);
    }
  }

  return applied;
}

export async function runMigrationsWithPg(databaseUrl?: string): Promise<string[]> {
  const connectionString = databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be specified to run migrations with pg");
  }

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      return await runMigrations(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
