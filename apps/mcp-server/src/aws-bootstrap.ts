/**
 * Create DynamoDB tables (pay-per-request) if missing.
 *
 * Usage (from repo root, with AWS creds configured):
 *   pnpm --filter @chaperone/mcp-server aws:bootstrap
 */
import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureTables, ledgerTableName, proposalsTableName } from "@chaperone/ledger/dynamodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../.env") });

const region = process.env.AWS_REGION ?? "us-east-1";
console.log(`Bootstrapping DynamoDB in ${region}…`);
console.log(`  proposals → ${proposalsTableName()}`);
console.log(`  ledger    → ${ledgerTableName()}`);

await ensureTables(region);
console.log("Done. Tables ready (or already existed).");
console.log("Set CHAPERONE_AWS=1 in apps/mcp-server/.env and restart pnpm dev:mcp");
