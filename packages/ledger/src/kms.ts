import { createHash } from "node:crypto";

import { KMSClient, SignCommand, VerifyCommand } from "@aws-sdk/client-kms";

import { createStubSigner } from "./stub.js";

/**
 * Env helper for sync ledger path — always stub.
 * Live KMS is async; use {@link asyncKmsSign} when persisting to DynamoDB.
 */
export function createSignerFromEnv() {
  return createStubSigner(process.env.CHAPERONE_STUB_HMAC_SECRET);
}

export function awsEnabled(): boolean {
  return process.env.CHAPERONE_AWS === "1";
}

/** Async KMS sign (SHA-256 digest of message). Falls back to stub if no key id. */
export async function asyncKmsSign(
  message: string,
  keyId = process.env.CHAPERONE_KMS_KEY_ID,
  region = process.env.AWS_REGION ?? "us-east-1",
): Promise<string> {
  if (!keyId) {
    return createStubSigner().sign(message);
  }
  const client = new KMSClient({ region });
  const digest = createHash("sha256").update(message, "utf8").digest();
  const out = await client.send(
    new SignCommand({
      KeyId: keyId,
      Message: digest,
      MessageType: "DIGEST",
      SigningAlgorithm: "RSASSA_PSS_SHA_256",
    }),
  );
  return Buffer.from(out.Signature ?? []).toString("hex");
}

export async function asyncKmsVerify(
  message: string,
  signatureHex: string,
  keyId = process.env.CHAPERONE_KMS_KEY_ID,
  region = process.env.AWS_REGION ?? "us-east-1",
): Promise<boolean> {
  if (!keyId) {
    return createStubSigner().verify(message, signatureHex);
  }
  const client = new KMSClient({ region });
  const digest = createHash("sha256").update(message, "utf8").digest();
  const out = await client.send(
    new VerifyCommand({
      KeyId: keyId,
      Message: digest,
      MessageType: "DIGEST",
      Signature: Buffer.from(signatureHex, "hex"),
      SigningAlgorithm: "RSASSA_PSS_SHA_256",
    }),
  );
  return !!out.SignatureValid;
}
