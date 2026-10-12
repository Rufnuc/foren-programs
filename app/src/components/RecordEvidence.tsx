"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./Button";
import { aesEncrypt, sha256, randomBytes } from "@/lib/crypto";
import {
  putEvidence,
  nextNonce,
  type EvidenceRow,
  type EvidenceType,
} from "@/lib/storage";
import { anchorHashOnChain } from "@/lib/solana";
import { pinBlob } from "@/lib/relay";
import { useAppStore } from "@/state/store";

type Phase = "idle" | "capturing" | "encrypting" | "anchoring" | "pinning" | "done" | "error";

function classifyMime(mime: string): EvidenceType {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "note";
}

/**
 * Capture flow: take a photo (or pick a file), encrypt locally, hash,
 * anchor the hash on Solana, then pin the ciphertext to IPFS via the
 * relay. The relay only ever sees ciphertext.
 */
export function RecordEvidence() {
  const { t } = useTranslation();
  const keypair = useAppStore((s) => s.keypair);
  const vaultKey = useAppStore((s) => s.vaultKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!keypair || !vaultKey) {
      setPhase("error");
      setMsg(t("evidence.lockedFirst"));
      return;
    }
    try {
      setPhase("capturing");
      const plaintext = new Uint8Array(await file.arrayBuffer());

      setPhase("encrypting");
      const contentHash = await sha256(plaintext);
      const sealed = await aesEncrypt(vaultKey, plaintext);

      // Random location commitment placeholder: real geo is supplied via
      // the proof flow, not at capture time. Anchoring still records a
      // 32-byte slot so verifiers can later bind it to the proof.
      const locationCommitment = randomBytes(32);
      const nonce = await nextNonce();

      setPhase("anchoring");
      const tx = await anchorHashOnChain(keypair, {
        nonce,
        hash: contentHash,
        locationCommitment,
      });

      setPhase("pinning");
      let cid: string | undefined;
      try {
        const pinned = await pinBlob(sealed.ciphertext);
        cid = pinned.cid;
      } catch {
        // Fail-soft: keep the local copy, queue for later.
        cid = undefined;
      }

      const row: EvidenceRow = {
        id: crypto.randomUUID(),
        type: classifyMime(file.type),
        capturedAt: Date.now(),
        sealed,
        contentType: file.type || "application/octet-stream",
        contentHash,
        locationCommitment,
        nonce,
        anchored: true,
        anchorPda: tx.pda,
        anchorTx: tx.signature,
        anchorSlot: tx.slot,
        cid,
      };
      await putEvidence(row);

      setPhase("done");
      setMsg(t("evidence.recorded"));
    } catch (e) {
      setPhase("error");
      setMsg((e as Error).message);
    }
  }

  return (
    <section className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,audio/*,application/pdf"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        full
        size="lg"
        onClick={() => inputRef.current?.click()}
        disabled={phase !== "idle" && phase !== "done" && phase !== "error"}
      >
        {phase === "idle" || phase === "done" || phase === "error"
          ? t("evidence.record")
          : t(`evidence.phase.${phase}`)}
      </Button>
      {msg && (
        <p
          role="status"
          aria-live="polite"
          className={phase === "error" ? "text-danger text-sm" : "text-muted text-sm"}
        >
          {msg}
        </p>
      )}
    </section>
  );
}
