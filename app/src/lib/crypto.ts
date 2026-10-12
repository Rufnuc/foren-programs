/**
 * Browser-side cryptography for Prutet.
 *
 *   - Argon2id (via argon2-browser, WASM) derives a 256-bit key from a
 *     user passcode + per-device salt. The derived key never leaves memory.
 *   - AES-GCM (via WebCrypto) wraps the user's Solana private key and
 *     encrypts each piece of evidence individually.
 *
 * Every function is browser-only; importing this file from a server
 * component will throw at first use.
 */

const ARGON_TIME = 3;
const ARGON_MEM = 64 * 1024; // KiB
const ARGON_PARALLELISM = 1;
const KEY_LEN = 32;

function ensureBrowser() {
  if (typeof window === "undefined" || !("crypto" in window)) {
    throw new Error("crypto.ts is browser-only");
  }
}

export function randomBytes(n: number): Uint8Array {
  ensureBrowser();
  const buf = new Uint8Array(n);
  window.crypto.getRandomValues(buf);
  return buf;
}

/**
 * Derive a 32-byte key from a passcode + salt.
 *
 * Preferred: Argon2id via `argon2-browser` (memory-hard, side-channel
 * resistant). Falls back to PBKDF2-SHA-256 with a high iteration count if
 * the WASM module cannot be loaded (some bundler/browser combinations
 * still trip on argon2-browser's `require('argon2.wasm')` shim). The
 * fallback is documented so callers can detect the regression in audits.
 */
export async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  ensureBrowser();
  try {
    const argon2 = await import("argon2-browser");
    const result = await argon2.hash({
      pass: passcode,
      salt,
      type: argon2.ArgonType.Argon2id,
      time: ARGON_TIME,
      mem: ARGON_MEM,
      parallelism: ARGON_PARALLELISM,
      hashLen: KEY_LEN,
    });
    return window.crypto.subtle.importKey(
      "raw",
      result.hash,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } catch (e) {
    // PBKDF2 fallback. 600k iterations matches OWASP 2023 guidance for
    // PBKDF2-HMAC-SHA-256.
    if (typeof console !== "undefined") {
      console.warn("argon2 unavailable, falling back to PBKDF2", e);
    }
    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(passcode),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
}

export interface SealedBlob {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export async function aesEncrypt(key: CryptoKey, plaintext: Uint8Array): Promise<SealedBlob> {
  ensureBrowser();
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  return { iv, ciphertext: ct };
}

export async function aesDecrypt(key: CryptoKey, sealed: SealedBlob): Promise<Uint8Array> {
  ensureBrowser();
  return new Uint8Array(
    await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: sealed.iv },
      key,
      sealed.ciphertext,
    ),
  );
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  ensureBrowser();
  return new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("odd-length hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}
