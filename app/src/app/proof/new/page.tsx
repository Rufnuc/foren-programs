"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { getEvidence, type EvidenceRow } from "@/lib/storage";
import { ProofClient, type ProofResponse } from "@/lib/proof";
import { randomBytes, toHex } from "@/lib/crypto";

const WASM_URL = "/zk/evidence_zk.wasm";
const ZKEY_URL = "/zk/evidence_zk_final.zkey";

/** Encode latitude/longitude in a positive integer field-friendly form. */
function geoToBigInt(deg: number): bigint {
  // 6 decimal places of precision → ~11cm accuracy. Shift to non-negative.
  const scaled = Math.round((deg + 180) * 1_000_000);
  return BigInt(Math.max(0, scaled));
}

function ProofForm() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const id = params.get("id");

  const [row, setRow] = useState<EvidenceRow | null>(null);
  const [slotMin, setSlotMin] = useState("");
  const [slotMax, setSlotMax] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofResponse | null>(null);

  const client = useMemo(() => new ProofClient(), []);
  useEffect(() => () => client.stop(), [client]);

  useEffect(() => {
    if (!id) return;
    void getEvidence(id).then((r) => {
      if (r) {
        setRow(r);
        if (r.anchorSlot) {
          setSlotMin(String(r.anchorSlot));
          setSlotMax(String(r.anchorSlot + 1000));
        }
      }
    });
  }, [id]);

  async function generate() {
    if (!row || busy) return;
    setBusy(true);
    setErr(null);
    setProof(null);
    try {
      const slot = BigInt(row.anchorSlot ?? 0);
      const slotMinBn = BigInt(slotMin || "0");
      const slotMaxBn = BigInt(slotMax || "0");
      if (slot < slotMinBn || slot > slotMaxBn) {
        throw new Error(t("proof.slotOutOfRange"));
      }
      const latBn = geoToBigInt(parseFloat(lat));
      const lonBn = geoToBigInt(parseFloat(lon));
      const locSalt = randomBytes(16);

      const result = await client.prove({
        contentHash: row.contentHash,
        slot,
        slotMin: slotMinBn,
        slotMax: slotMaxBn,
        lat: latBn,
        lon: lonBn,
        locSalt,
        wasmUrl: WASM_URL,
        zkeyUrl: ZKEY_URL,
      });
      setProof(result);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-6">
      <Link href="/" className="text-sm underline text-ink hover:text-accent">
        ← {t("nav.home")}
      </Link>
      <h1 className="text-2xl font-semibold text-ink">{t("proof.title")}</h1>
      <p className="text-muted">{t("proof.intro")}</p>

      {!row && (
        <p className="text-muted">
          {t("proof.pickEvidence")}{" "}
          <Link href="/evidence" className="underline">
            {t("evidence.title")}
          </Link>
        </p>
      )}

      {row && (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface p-4 text-sm text-muted">
            <div>{t("evidence.contentHash")}</div>
            <div className="font-mono break-all text-ink">
              {toHex(row.contentHash)}
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-muted">{t("proof.slotMin")}</span>
            <input
              inputMode="numeric"
              value={slotMin}
              onChange={(e) => setSlotMin(e.target.value)}
              className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">{t("proof.slotMax")}</span>
            <input
              inputMode="numeric"
              value={slotMax}
              onChange={(e) => setSlotMax(e.target.value)}
              className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-muted">{t("proof.lat")}</span>
              <input
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-muted">{t("proof.lon")}</span>
              <input
                inputMode="decimal"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2"
              />
            </label>
          </div>

          {err && <p role="alert" className="text-danger text-sm">{err}</p>}

          <Button full size="lg" onClick={generate} disabled={busy}>
            {busy ? t("proof.generating") : t("proof.generate")}
          </Button>
        </div>
      )}

      {proof && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{t("proof.result")}</h2>
          <p className="text-muted text-sm">{t("proof.publicSignals")}</p>
          <pre className="rounded-md bg-surface p-3 text-xs overflow-x-auto">
            {JSON.stringify(proof.publicSignals, null, 2)}
          </pre>
          <Button
            variant="secondary"
            full
            onClick={async () => {
              const blob = new Blob(
                [JSON.stringify(proof, null, 2)],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `prutet-proof-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t("proof.download")}
          </Button>
        </section>
      )}
    </main>
  );
}

export default function ProofNewPage() {
  return (
    <Suspense fallback={null}>
      <ProofForm />
    </Suspense>
  );
}
