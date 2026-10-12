"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { RecordEvidence } from "@/components/RecordEvidence";
import { useAppStore } from "@/state/store";

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useAppStore((s) => s.status);

  useEffect(() => {
    if (status === "absent") router.replace("/onboarding");
  }, [status, router]);

  if (status !== "unlocked") return null;

  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-ink">{t("app.name")}</h1>
        <p className="mt-1 text-muted">{t("home.tagline")}</p>
      </header>

      <RecordEvidence />

      <nav aria-label={t("nav.label") ?? undefined} className="grid grid-cols-2 gap-3">
        <Link
          href="/evidence"
          className="rounded-lg bg-surface p-4 text-center text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t("nav.evidence")}
        </Link>
        <Link
          href="/proof/new"
          className="rounded-lg bg-surface p-4 text-center text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t("nav.proof")}
        </Link>
        <Link
          href="/settings"
          className="col-span-2 rounded-lg bg-surface p-4 text-center text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t("nav.settings")}
        </Link>
      </nav>

      <p className="text-xs text-muted">{t("home.privacyNote")}</p>
    </main>
  );
}
