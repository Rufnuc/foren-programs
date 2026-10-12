/**
 * Identity lifecycle: create, unlock, and burn.
 *
 * The user's identity is a Solana keypair generated with the standard
 * `Keypair.generate()`; it is never registered, named, or linked to a
 * phone/email. The 64-byte secret is wrapped with an AES-GCM key derived
 * from the passcode and stored in IndexedDB. Burning destroys the wrapped
 * key (and, optionally, every captured evidence row) — once that is gone,
 * nothing on this device can sign as that pubkey ever again.
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import {
  aesDecrypt,
  aesEncrypt,
  deriveKey,
  randomBytes,
} from "./crypto";
import { clearVault, getMeta, putMeta, type VaultMeta } from "./storage";

export interface UnlockedIdentity {
  keypair: Keypair;
  publicKey: string; // base58
  vaultKey: CryptoKey;
}

export async function isOnboarded(): Promise<boolean> {
  return Boolean(await getMeta());
}

export async function createIdentity(
  passcode: string,
  prefs: { locale: string; region: string; contrast: "default" | "high" },
): Promise<UnlockedIdentity> {
  if (passcode.length < 8) throw new Error("passcode too short");
  const salt = randomBytes(16);
  const vaultKey = await deriveKey(passcode, salt);

  const kp = Keypair.generate();
  const wrappedSecretKey = await aesEncrypt(vaultKey, kp.secretKey);

  const meta: VaultMeta = {
    id: "vault",
    passcodeSalt: salt,
    wrappedSecretKey,
    publicKey: bs58.encode(kp.publicKey.toBytes()),
    locale: prefs.locale,
    region: prefs.region,
    contrast: prefs.contrast,
    contactsSealed: null,
    createdAt: Date.now(),
  };
  await putMeta(meta);

  return { keypair: kp, publicKey: meta.publicKey, vaultKey };
}

export async function unlockIdentity(passcode: string): Promise<UnlockedIdentity> {
  const meta = await getMeta();
  if (!meta) throw new Error("not onboarded");

  const vaultKey = await deriveKey(passcode, meta.passcodeSalt);
  let secretKey: Uint8Array;
  try {
    secretKey = await aesDecrypt(vaultKey, meta.wrappedSecretKey);
  } catch {
    throw new Error("wrong passcode");
  }
  const kp = Keypair.fromSecretKey(secretKey);
  return {
    keypair: kp,
    publicKey: bs58.encode(kp.publicKey.toBytes()),
    vaultKey,
  };
}

/**
 * Burn the identity. By default this clears *everything* (the wrapped key
 * AND all captured evidence) since the user is exercising their right to
 * erasure; pass `keepEvidence: true` if you only want to revoke the
 * signing key but keep encrypted blobs the user can no longer associate
 * with on-chain anchors.
 */
export async function burnIdentity(opts: { keepEvidence?: boolean } = {}): Promise<void> {
  if (opts.keepEvidence) {
    const meta = await getMeta();
    if (!meta) return;
    // Replace the wrapped key with random bytes the user has no key for.
    const dead = randomBytes(meta.wrappedSecretKey.ciphertext.length);
    await putMeta({
      ...meta,
      wrappedSecretKey: { iv: randomBytes(12), ciphertext: dead },
    });
  } else {
    await clearVault();
  }
}
