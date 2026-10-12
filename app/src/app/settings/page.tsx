"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { RegionPicker } from "@/components/RegionPicker";
import { HighContrastToggle } from "@/components/HighContrastToggle";
import { burnIdentity } from "@/lib/identity";
import { useAppStore } from "@/state/store";

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const setAbsent = useAppStore((s) => s.setAbsent);
  const lock = useAppStore((s) => s.lock);
  const publicKey = useAppStore((s) => s.publicKey);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function burn() {
    if (busy) return;
    setBusy(true);
    try {
      await burnIdentity({ keepEvidence: false });
      setAbsent();
      router.replace("/onboarding");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-6">
      <Link href="/" className="text-sm underline text-ink hover:text-accent">
        ← {t("nav.home")}
      </Link>
      <h1 className="text-2xl font-semibold text-ink">{t("settings.title")}</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-ink">{t("settings.preferences")}</h2>
        <LanguagePicker />
        <RegionPicker />
        <HighContrastToggle />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-ink">{t("settings.identity")}</h2>
        <p className="text-sm text-muted">{t("settings.publicKey")}</p>
        <p className="font-mono text-xs break-all">{publicKey ?? "—"}</p>
        <Button variant="secondary" onClick={lock}>
          {t("settings.lock")}
        </Button>
      </section>

      <section className="space-y-3 rounded-lg border border-danger/30 p-4">
        <h2 className="text-lg font-medium text-danger">{t("settings.burnTitle")}</h2>
        <p className="text-sm text-muted">{t("settings.burnBody")}</p>

        {step === 0 && (
          <Button variant="danger" onClick={() => setStep(1)}>
            {t("settings.burnStart")}
          </Button>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("settings.burnConfirm1")}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={() => setStep(2)}>
                {t("settings.burnContinue")}
              </Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-muted">
                {t("settings.burnTypePrompt")}
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 block w-full rounded-md border border-danger/50 bg-bg px-3 py-2"
                placeholder="BURN"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={burn}
                disabled={confirmText !== "BURN" || busy}
              >
                {busy ? t("common.loading") : t("settings.burnFinal")}
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
