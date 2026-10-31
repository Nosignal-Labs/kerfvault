export interface IngestConfig {
  rpcUrl: string;
  contractId: string;
  startLedger?: number;
}

/**
 * Ingests contract events (book_opened, note_redeemed, book_reclaimed)
 * from Soroban RPC getEvents API and writes them to Postgres.
 */
export async function startEventIngestion(_config: IngestConfig): Promise<void> {
  // TODO: Implement event polling loop against Soroban RPC getEvents endpoint and update local database
  throw new Error("TODO: startEventIngestion RPC consumer loop not implemented");
}

