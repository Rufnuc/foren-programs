/**
 * IndexedDB-backed storage for Prutet. There are exactly two tables:
 *
 *   meta      — singleton row (id="vault") with the encrypted Solana key,
 *               KDF salt, locale/region/contrast preferences, and emergency
 *               contacts (themselves encrypted with the vault key).
 *   evidence  — one row per captured evidence item, encrypted with the
 *               vault key.
 *
 * IndexedDB itself is not encrypted, so anything that should not survive
 * device theft must be stored as `SealedBlob`. The vault key is held only
 * in-memory after unlock.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { SealedBlob } from "./crypto";

const DB_NAME = "prutet";
const DB_VERSION = 1;

export type EvidenceType = "photo" | "video" | "audio" | "note";

export interface VaultMeta {
  id: "vault";
  passcodeSalt: Uint8Array;
  /** AES-GCM-wrapped Solana private key (raw 64-byte secret). */
  wrappedSecretKey: SealedBlob;
  publicKey: string; // base58
  locale: string;
  region: string;
  contrast: "default" | "high";
  contactsSealed: SealedBlob | null;
  createdAt: number;
}

export interface EvidenceRow {
  id: string;
  type: EvidenceType;
  capturedAt: number;
  /** AES-GCM-wrapped raw bytes (or UTF-8 of the note). */
  sealed: SealedBlob;
  contentType: string;
  /** Hash anchoring metadata (set after the on-chain anchor lands). */
  contentHash: Uint8Array;
  locationCommitment: Uint8Array;
  nonce: number;
  anchored: boolean;
  anchorPda?: string;
  anchorTx?: string;
  anchorSlot?: number;
  cid?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "id" });
        if (!d.objectStoreNames.contains("evidence")) {
          const s = d.createObjectStore("evidence", { keyPath: "id" });
          s.createIndex("capturedAt", "capturedAt");
          s.createIndex("anchored", "anchored");
        }
      },
    });
  }
  return dbPromise;
}

export async function getMeta(): Promise<VaultMeta | undefined> {
  return (await db()).get("meta", "vault");
}

export async function putMeta(meta: VaultMeta): Promise<void> {
  await (await db()).put("meta", meta);
}

export async function clearVault(): Promise<void> {
  const d = await db();
  await Promise.all([d.clear("meta"), d.clear("evidence")]);
}

export async function listEvidence(): Promise<EvidenceRow[]> {
  const d = await db();
  const all = await d.getAllFromIndex("evidence", "capturedAt");
  return all.reverse(); // newest first
}

export async function getEvidence(id: string): Promise<EvidenceRow | undefined> {
  return (await db()).get("evidence", id);
}

export async function putEvidence(row: EvidenceRow): Promise<void> {
  await (await db()).put("evidence", row);
}

export async function deleteEvidence(id: string): Promise<void> {
  await (await db()).delete("evidence", id);
}

export async function nextNonce(): Promise<number> {
  const all = await listEvidence();
  return all.reduce((max, r) => Math.max(max, r.nonce + 1), 0);
}
