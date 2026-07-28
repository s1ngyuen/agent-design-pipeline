// Application-layer encryption for eBay OAuth tokens at rest
// (`ebay_accounts.access_token` / `.refresh_token`, src/db/schema.ts).
//
// These tokens grant live write access to a real eBay seller account (list,
// edit, publish), so they're encrypted before every insert/update and only
// ever decrypted inside src/lib/ebay/auth.ts, where they're actually used to
// call eBay's API. Never log a decrypted value, and never pass a decrypted
// token anywhere outside that module.
//
// AES-256-GCM: authenticated encryption (detects tampering, not just
// confidentiality), which matters here since a corrupted/tampered token
// could otherwise be silently sent to eBay's API. Key comes from
// EBAY_TOKEN_ENCRYPTION_KEY (see .env.example) — 32 raw bytes, base64-encoded.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, standard for GCM
const AUTH_TAG_LENGTH = 16;

let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  const raw = process.env.EBAY_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('EBAY_TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'EBAY_TOKEN_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256-GCM',
    );
  }
  _key = key;
  return key;
}

/** Encrypts a plaintext token for storage. Output format: base64(iv || authTag || ciphertext). */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Decrypts a token previously produced by encryptToken(). Never log the result. */
export function decryptToken(encoded: string): string {
  const key = getKey();
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
