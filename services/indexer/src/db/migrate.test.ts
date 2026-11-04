import { describe, it, expect, vi } from "vitest";
import {
  MIGRATIONS,
  initMigrationTable,
  getAppliedMigrations,
  getPendingMigrations,
  runMigrations,
  runMigrationsWithPg,
  type Queryable,
  type Migration,
} from "./migrate.js";

function createMockDb(): { client: Queryable; queries: string[]; state: { migrations: string[] } } {
  const queries: string[] = [];
  const state = {
    migrations: [] as string[],
  };

  const client: Queryable = {
    query: vi.fn(async <R = any>(text: string, values?: unknown[]) => {
      queries.push(text);
      if (text.includes("SELECT name FROM schema_migrations")) {
        return {
          rows: state.migrations.map((name) => ({ name })) as unknown as R[],
        };
      }
      if (text.includes("INSERT INTO schema_migrations")) {
        const name = (values?.[0] as string) ?? "unknown";
        state.migrations.push(name);
        return { rows: [] as R[] };
      }
      return { rows: [] as R[] };
    }),
  };

  return { client, queries, state };
}

describe("Database Migrations", () => {
  it("defines ordered, valid migrations", () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].id).toBe(i + 1);
      expect(MIGRATIONS[i].name).toBeTruthy();
      expect(MIGRATIONS[i].sql.trim().length).toBeGreaterThan(0);
    }
  });

  it("initializes schema_migrations table", async () => {
    const { client, queries } = createMockDb();
    await initMigrationTable(client);
    expect(queries.some((q) => q.includes("CREATE TABLE IF NOT EXISTS schema_migrations"))).toBe(true);
  });

  it("retrieves applied migrations list", async () => {
    const { client, state } = createMockDb();
    state.migrations = ["001_initial_schema"];
    const applied = await getAppliedMigrations(client);
    expect(applied).toEqual(["001_initial_schema"]);
  });

  it("calculates pending migrations correctly", async () => {
    const { client, state } = createMockDb();
    state.migrations = ["001_initial_schema"];
    const pending = await getPendingMigrations(client);
    expect(pending.map((m) => m.name)).toEqual([
      "002_add_cursor_to_sync_state",
      "003_contract_events_audit",
    ]);
  });

  it("executes all pending migrations in order and updates schema_migrations", async () => {
    const { client, queries, state } = createMockDb();
    const applied = await runMigrations(client);

    expect(applied).toEqual([
      "001_initial_schema",
      "002_add_cursor_to_sync_state",
      "003_contract_events_audit",
    ]);
    expect(state.migrations).toEqual([
      "001_initial_schema",
      "002_add_cursor_to_sync_state",
      "003_contract_events_audit",
    ]);
    expect(queries).toContain("BEGIN;");
    expect(queries).toContain("COMMIT;");
  });

  it("is idempotent when running migrations a second time", async () => {
    const { client, state } = createMockDb();
    const firstRun = await runMigrations(client);
    expect(firstRun.length).toBe(3);

    const secondRun = await runMigrations(client);
    expect(secondRun).toEqual([]);
    expect(state.migrations.length).toBe(3);
  });

  it("rolls back transaction and throws on migration error", async () => {
    const queries: string[] = [];
    const client: Queryable = {
      query: vi.fn(async <R = any>(text: string) => {
        queries.push(text);
        if (text.includes("SELECT name FROM schema_migrations")) {
          return { rows: [] as R[] };
        }
        if (text.includes("FAIL_HERE")) {
          throw new Error("Syntax error at or near FAIL");
        }
        return { rows: [] as R[] };
      }),
    };

    const faultyMigrations: Migration[] = [
      { id: 1, name: "failing_migration", sql: "FAIL_HERE;" },
    ];

    await expect(runMigrations(client, faultyMigrations)).rejects.toThrow(
      "Failed to apply migration 'failing_migration'"
    );
    expect(queries).toContain("ROLLBACK;");
  });

  it("throws when DATABASE_URL is not provided to runMigrationsWithPg", async () => {
    delete process.env.DATABASE_URL;
    await expect(runMigrationsWithPg()).rejects.toThrow(
      "DATABASE_URL must be specified to run migrations with pg"
    );
  });
});
