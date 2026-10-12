"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { aesDecrypt, toHex } from "@/lib/crypto";
import {
  deleteEvidence,
  getEvidence,
  type EvidenceRow,
} from "@/lib/storage";
import { revokeAnchorOnChain } from "@/lib/solana";
import { useAppStore } from "@/state/store";

export default function EvidenceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const keypair = useAppStore((s) => s.keypair);
  const vaultKey = useAppStore((s) => s.vaultKey);

  const [row, setRow] = useState<EvidenceRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      if (!id || !vaultKey) return;
      const r = await getEvidence(id);
      if (cancelled || !r) return;
      setRow(r);
      try {
        const plaintext = await aesDecrypt(vaultKey, r.sealed);
        const blob = new Blob([plaintext], { type: r.contentType });
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, vaultKey]);

  async function handleRevoke() {
    if (!row || !keypair || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await revokeAnchorOnChain(keypair, { nonce: row.nonce });
      await deleteEvidence(row.id);
      router.replace("/evidence");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!row) return <main className="p-6 text-muted">{t("common.loading")}</main>;

  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-6">
      <Link
        href="/evidence"
        className="text-sm underline text-ink hover:text-accent"
      >
        ← {t("evidence.title")}
      </Link>
      <h1 className="text-2xl font-semibold text-ink">
        {new Date(row.capturedAt).toLocaleString()}
      </h1>

      {previewUrl && row.type === "photo" && (
        <img
          src={previewUrl}
          alt={t("evidence.previewAlt") ?? ""}
          className="w-full rounded-lg border border-muted/30"
        />
      )}
      {previewUrl && row.type === "video" && (
        <video src={previewUrl} controls className="w-full rounded-lg" />
      )}
      {previewUrl && row.type === "audio" && (
        <audio src={previewUrl} controls className="w-full" />
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">{t("evidence.contentHash")}</dt>
        <dd className="font-mono break-all">{toHex(row.contentHash)}</dd>
        <dt className="text-muted">{t("evidence.nonce")}</dt>
        <dd>{row.nonce}</dd>
        <dt className="text-muted">{t("evidence.anchorTx")}</dt>
        <dd className="font-mono break-all">{row.anchorTx ?? "—"}</dd>
        <dt className="text-muted">{t("evidence.anchorPda")}</dt>
        <dd className="font-mono break-all">{row.anchorPda ?? "—"}</dd>
        <dt className="text-muted">{t("evidence.cid")}</dt>
        <dd className="font-mono break-all">{row.cid ?? t("evidence.localOnly")}</dd>
      </dl>

      {err && <p role="alert" className="text-danger text-sm">{err}</p>}

      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          onClick={() => router.push(`/proof/new?id=${row.id}`)}
        >
          {t("evidence.makeProof")}
        </Button>
        <Button variant="danger" onClick={handleRevoke} disabled={busy}>
          {busy ? t("common.loading") : t("evidence.revoke")}
        </Button>
      </div>
    </main>
  );
}
