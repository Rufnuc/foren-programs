"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { RegionPicker } from "@/components/RegionPicker";
import { HighContrastToggle } from "@/components/HighContrastToggle";
import { createIdentity } from "@/lib/identity";
import { useAppStore } from "@/state/store";

type Step = "intro" | "preferences" | "passcode" | "creating";

export default function OnboardingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useAppStore((s) => s.status);
  const locale = useAppStore((s) => s.locale);
  const region = useAppStore((s) => s.region);
  const contrast = useAppStore((s) => s.contrast);
  const setUnlocked = useAppStore((s) => s.setUnlocked);

  const [step, setStep] = useState<Step>("intro");
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "locked" || status === "unlocked") router.replace("/");
  }, [status, router]);

  async function submit() {
    setErr(null);
    if (passcode.length < 8) {
      setErr(t("onboarding.passcodeTooShort"));
      return;
    }
    if (passcode !== confirm) {
      setErr(t("onboarding.passcodeMismatch"));
      return;
    }
    setStep("creating");
    try {
      const id = await createIdentity(passcode, { locale, region, contrast });
      setUnlocked(id);
      router.replace("/");
    } catch (e) {
      setErr((e as Error).message);
      setStep("passcode");
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold text-ink">{t("onboarding.title")}</h1>

      {step === "intro" && (
        <>
          <p className="text-muted">{t("onboarding.intro1")}</p>
          <p className="text-muted">{t("onboarding.intro2")}</p>
          <ul className="text-muted text-sm list-disc pl-5 space-y-1">
            <li>{t("onboarding.bullet1")}</li>
            <li>{t("onboarding.bullet2")}</li>
            <li>{t("onboarding.bullet3")}</li>
          </ul>
          <Button full size="lg" onClick={() => setStep("preferences")}>
            {t("common.continue")}
          </Button>
        </>
      )}

      {step === "preferences" && (
        <div className="space-y-4">
          <p className="text-muted">{t("onboarding.prefsHelp")}</p>
          <LanguagePicker />
          <RegionPicker />
          <HighContrastToggle />
          <Button full size="lg" onClick={() => setStep("passcode")}>
            {t("common.continue")}
          </Button>
        </div>
      )}

      {(step === "passcode" || step === "creating") && (
        <div className="space-y-4">
          <p className="text-muted">{t("onboarding.passcodeHelp")}</p>
          <label className="block">
            <span className="text-sm text-muted">{t("onboarding.passcode")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">{t("onboarding.passcodeConfirm")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          {err && <p role="alert" className="text-danger text-sm">{err}</p>}
          <Button full size="lg" onClick={submit} disabled={step === "creating"}>
            {step === "creating" ? t("common.loading") : t("onboarding.create")}
          </Button>
          <p className="text-xs text-muted">{t("onboarding.passcodeWarn")}</p>
        </div>
      )}
    </main>
  );
}
