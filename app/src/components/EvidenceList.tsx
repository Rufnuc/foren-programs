"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listEvidence, type EvidenceRow } from "@/lib/storage";
import { toHex } from "@/lib/crypto";

export function EvidenceList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EvidenceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEvidence().then((r) => {
      if (!cancelled) setRows(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows) return <p className="text-muted">{t("common.loading")}</p>;
  if (rows.length === 0) return <p className="text-muted">{t("evidence.empty")}</p>;

  return (
    <ul className="divide-y divide-muted/20 rounded-lg bg-surface">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/evidence/${r.id}`}
            className="block px-4 py-3 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-ink truncate">
                {new Date(r.capturedAt).toLocaleString()}
              </span>
              <span className="text-xs text-muted">
                {r.cid ? "IPFS" : t("evidence.localOnly")}
              </span>
            </div>
            <div className="mt-1 font-mono text-xs text-muted truncate">
              {toHex(r.contentHash).slice(0, 24)}…
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
