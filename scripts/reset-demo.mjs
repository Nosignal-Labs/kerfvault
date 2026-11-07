#!/usr/bin/env node

/**
 * KerfVault Demo Reset Script
 *
 * Resets the demo state to a clean scenario:
 * 1. Generates fresh throwaway Stellar testnet identities (Shopper, Merchant, Relay).
 * 2. Optionally funds them via Friendbot on Stellar Testnet (or runs in --dry-run / --offline mode).
 * 3. Cleans any transient local state and writes a fresh `.demo-scenario.json`.
 * 4. Prints instructions and credentials for launching the demo apps.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Dynamically resolve stellar-sdk from sdk workspace
let Keypair;
try {
  const req = createRequire(path.join(rootDir, 'packages/sdk/package.json'));
  ({ Keypair } = req('@stellar/stellar-sdk'));
} catch (e) {
  try {
    const sdkEsm = await import('../packages/sdk/node_modules/@stellar/stellar-sdk/lib/esm/index.js');
    Keypair = sdkEsm.Keypair;
  } catch (err) {
    console.error('Failed to load @stellar/stellar-sdk:', err.message);
    process.exit(1);
  }
}

// Default Testnet Contract and Token values
const DEFAULT_CONTRACT_ID = 'CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE';
const DEFAULT_NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

async function fundAccount(publicKey) {
  try {
    const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(publicKey)}`);
    if (res.ok) {
      return { success: true };
    }
    const errText = await res.text();
    return { success: false, error: errText };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function resetDemoState(options = {}) {
  const isDryRun = Boolean(options.dryRun || options.offline);
  const shouldFund = options.fund !== false && !isDryRun;
  const silent = Boolean(options.silent);

  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('================================================================');
  log('              KerfVault Demo State Reset Tool                   ');
  log('================================================================\n');

  // 1. Clean local state files
  const scenarioPath = path.join(rootDir, '.demo-scenario.json');
  const localQueuePath = path.join(rootDir, '.demo-queue.json');

  if (fs.existsSync(localQueuePath)) {
    fs.unlinkSync(localQueuePath);
    log(' [✓] Cleared transient local queue (.demo-queue.json)');
  }

  // 2. Generate fresh identities
  const shopper = Keypair.random();
  const merchant = Keypair.random();
  const relay = Keypair.random();

  log(' [✓] Generated fresh demo identities:');
  log(`     - Shopper:  ${shopper.publicKey()}`);
  log(`     - Merchant: ${merchant.publicKey()}`);
  log(`     - Relay:    ${relay.publicKey()}`);

  // 3. Fund accounts if requested
  const fundingResults = {
    shopper: null,
    merchant: null,
    relay: null,
  };

  if (shouldFund) {
    log('\n [•] Requesting testnet funding via Friendbot...');

    fundingResults.shopper = await fundAccount(shopper.publicKey());
    log(`     - Shopper funding:  ${fundingResults.shopper.success ? '10,000 XLM funded' : 'FAILED (' + fundingResults.shopper.error + ')'}`);

    fundingResults.merchant = await fundAccount(merchant.publicKey());
    log(`     - Merchant funding: ${fundingResults.merchant.success ? '10,000 XLM funded' : 'FAILED (' + fundingResults.merchant.error + ')'}`);

    fundingResults.relay = await fundAccount(relay.publicKey());
    log(`     - Relay funding:    ${fundingResults.relay.success ? '10,000 XLM funded' : 'FAILED (' + fundingResults.relay.error + ')'}`);
  } else if (isDryRun) {
    log('\n [i] Running in dry-run/offline mode (Friendbot funding skipped).');
  }

  // 4. Save clean scenario state
  const scenarioData = {
    contractId: process.env.KERFVAULT_CONTRACT_ID || DEFAULT_CONTRACT_ID,
    tokenAddress: process.env.TOKEN_ADDRESS || DEFAULT_NATIVE_SAC,
    assetCode: 'XLM',
    accounts: {
      shopper: {
        publicKey: shopper.publicKey(),
        secretKey: shopper.secret(),
      },
      merchant: {
        publicKey: merchant.publicKey(),
        secretKey: merchant.secret(),
      },
      relay: {
        publicKey: relay.publicKey(),
        secretKey: relay.secret(),
      },
    },
    funding: fundingResults,
    resetAt: new Date().toISOString(),
  };

  fs.writeFileSync(scenarioPath, JSON.stringify(scenarioData, null, 2), 'utf-8');
  log(`\n [✓] Saved clean scenario configuration to .demo-scenario.json`);

  log('\n================================================================');
  log('Demo scenario is ready! Next steps to run the demo:');
  log(' 1. Start Relay & Indexer:');
  log('    pnpm --filter @kerfvault/relay start');
  log('    pnpm --filter @kerfvault/indexer start');
  log(' 2. Start Shopper Web App:');
  log('    pnpm --filter @kerfvault/kerf dev (port 3000)');
  log(' 3. Start Merchant Reader App:');
  log('    pnpm --filter @kerfvault/reader dev (port 3001)');
  log('================================================================\n');

  return scenarioData;
}

// CLI Execution entrypoint
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  const isDryRun = args.includes('--dry-run') || args.includes('--offline');
  const noFund = args.includes('--no-fund');

  if (isHelp) {
    console.log(`
Usage: node scripts/reset-demo.mjs [options]

Options:
  --dry-run, --offline  Generate keys and clean state without network calls
  --no-fund             Generate keys and clean state without calling Friendbot
  --help, -h            Show this help message
`);
    process.exit(0);
  }

  resetDemoState({
    dryRun: isDryRun,
    fund: !noFund && !isDryRun,
  }).catch((err) => {
    console.error('Error resetting demo state:', err);
    process.exit(1);
  });
}

