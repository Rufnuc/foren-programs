"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { EvidenceList } from "@/components/EvidenceList";

export default function EvidenceIndexPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-ink">{t("evidence.title")}</h1>
        <Link
          href="/"
          className="text-sm underline text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md"
        >
          {t("nav.home")}
        </Link>
      </header>
      <EvidenceList />
    </main>
  );
}
