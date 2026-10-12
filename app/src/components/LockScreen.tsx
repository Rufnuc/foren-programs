"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { unlockIdentity } from "@/lib/identity";
import { useAppStore } from "@/state/store";
import { Button } from "./Button";

/**
 * The locked-state gate. Renders a passcode prompt; on success it loads
 * the keypair into the store. Identity material never leaves the device.
 */
export function LockScreen() {
  const { t } = useTranslation();
  const setUnlocked = useAppStore((s) => s.setUnlocked);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await unlockIdentity(passcode);
      setUnlocked(id);
      setPasscode("");
    } catch (e) {
      setErr(t("lock.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-bg text-ink">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">{t("lock.title")}</h1>
        <p className="text-muted">{t("lock.subtitle")}</p>
        <label className="block">
          <span className="sr-only">{t("lock.passcode")}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={t("lock.passcode") ?? ""}
            className="w-full rounded-lg border border-muted/40 bg-bg px-4 py-3 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>
        {err && (
          <p role="alert" className="text-danger text-sm">
            {err}
          </p>
        )}
        <Button type="submit" full size="lg" disabled={busy || !passcode}>
          {busy ? t("common.loading") : t("lock.unlock")}
        </Button>
      </form>
    </main>
  );
}
