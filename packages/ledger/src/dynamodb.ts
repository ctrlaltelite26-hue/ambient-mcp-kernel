import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { asyncKmsSign, awsEnabled } from "./kms.js";
import { entryMessage, GENESIS_HASH, type LedgerEntry } from "./index.js";

export interface StoredProposal {
  id: string;
  householdId: string;
  sessionId: string;
  payloadHash: string;
  status: string;
  policyVerdict: string;
  reasons: string[];
  requiresSecondApproval: boolean;
  payloadJson: string;
  createdAt: number;
  expiresAt: number;
}

function docClient(region = process.env.AWS_REGION ?? "us-east-1") {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function proposalsTableName(): string {
  return process.env.CHAPERONE_DDB_PROPOSALS_TABLE ?? "chaperone-proposals";
}

export function ledgerTableName(): string {
  return process.env.CHAPERONE_DDB_LEDGER_TABLE ?? "chaperone-ledger";
}

/** Best-effort table bootstrap for demo accounts (idempotent). */
export async function ensureTables(
  region = process.env.AWS_REGION ?? "us-east-1",
): Promise<void> {
  const client = new DynamoDBClient({ region });
  await ensureTable(client, proposalsTableName(), [
    { AttributeName: "pk", KeyType: "HASH" },
  ], [
    { AttributeName: "pk", AttributeType: "S" },
  ]);
  await ensureTable(client, ledgerTableName(), [
    { AttributeName: "householdId", KeyType: "HASH" },
    { AttributeName: "seq", KeyType: "RANGE" },
  ], [
    { AttributeName: "householdId", AttributeType: "S" },
    { AttributeName: "seq", AttributeType: "N" },
  ]);
}

async function ensureTable(
  client: DynamoDBClient,
  name: string,
  keySchema: { AttributeName: string; KeyType: "HASH" | "RANGE" }[],
  attrs: { AttributeName: string; AttributeType: "S" | "N" }[],
) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return;
  } catch {
    // create below
  }
  await client.send(
    new CreateTableCommand({
      TableName: name,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: attrs,
      KeySchema: keySchema,
    }),
  );
}

export async function putProposal(proposal: StoredProposal): Promise<void> {
  if (!awsEnabled()) return;
  const pk = `${proposal.householdId}::${proposal.sessionId}::${proposal.payloadHash}`;
  await docClient().send(
    new PutCommand({
      TableName: proposalsTableName(),
      Item: { pk, ...proposal },
    }),
  );
}

export async function getProposal(
  householdId: string,
  sessionId: string,
  payloadHash: string,
): Promise<StoredProposal | undefined> {
  if (!awsEnabled()) return undefined;
  const pk = `${householdId}::${sessionId}::${payloadHash}`;
  const out = await docClient().send(
    new GetCommand({
      TableName: proposalsTableName(),
      Key: { pk },
    }),
  );
  return out.Item as StoredProposal | undefined;
}

export async function appendLedgerRow(input: {
  householdId: string;
  entry: Omit<LedgerEntry, "kmsSignature"> & { kmsSignature?: string };
}): Promise<LedgerEntry> {
  let unsigned = {
    seq: input.entry.seq,
    prevHash: input.entry.prevHash,
    payloadHash: input.entry.payloadHash,
    verdict: input.entry.verdict,
    actorId: input.entry.actorId,
    createdAt: input.entry.createdAt,
  };

  const keyId = process.env.CHAPERONE_KMS_KEY_ID;
  if (awsEnabled() && keyId) {
    const existing = await listLedgerRows(input.householdId);
    const last = existing[existing.length - 1];
    if (last && last.seq >= unsigned.seq) {
      unsigned = {
        ...unsigned,
        seq: last.seq + 1,
        prevHash: last.payloadHash,
      };
    }
  }

  // In-memory ledger signs with stub HMAC. When a KMS key is configured, replace it.
  const kmsSignature = keyId
    ? await asyncKmsSign(entryMessage(unsigned), keyId)
    : (input.entry.kmsSignature ?? (await asyncKmsSign(entryMessage(unsigned))));
  const entry: LedgerEntry = { ...unsigned, kmsSignature };

  if (awsEnabled()) {
    await docClient().send(
      new PutCommand({
        TableName: ledgerTableName(),
        Item: {
          householdId: input.householdId,
          ...entry,
        },
        ConditionExpression: "attribute_not_exists(#s)",
        ExpressionAttributeNames: { "#s": "seq" },
      }),
    );
  }
  return entry;
}

export async function listLedgerRows(householdId: string): Promise<LedgerEntry[]> {
  if (!awsEnabled()) return [];
  const out = await docClient().send(
    new QueryCommand({
      TableName: ledgerTableName(),
      KeyConditionExpression: "householdId = :h",
      ExpressionAttributeValues: { ":h": householdId },
      ScanIndexForward: true,
    }),
  );
  return (out.Items ?? []) as LedgerEntry[];
}

export { GENESIS_HASH };
