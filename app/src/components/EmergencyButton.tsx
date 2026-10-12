"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppStore } from "@/state/store";
import { findRegion } from "@/lib/regions";

/**
 * Discreet, always-reachable emergency action. Long-press (1.2s) opens
 * a confirmation that surfaces the local emergency number for the user's
 * region. We never auto-dial — the user must take the final tap so this
 * cannot fire accidentally in a pocket or via a stray click.
 */
export function EmergencyButton() {
  const { t } = useTranslation();
  const region = useAppStore((s) => s.region);
  const reg = findRegion(region);
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function startHold() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(true), 1200);
  }
  function cancelHold() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return (
    <>
      <button
        aria-label={t("emergency.buttonLabel")}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setArmed(true);
        }}
        className="fixed bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-danger text-white shadow-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span aria-hidden="true" className="text-2xl font-bold">
          !
        </span>
      </button>
      {armed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-title"
          className="fixed inset-0 z-50 bg-ink/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => setArmed(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-bg p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="emergency-title" className="text-xl font-semibold text-ink">
              {t("emergency.confirmTitle")}
            </h2>
            <p className="mt-2 text-muted">{t("emergency.confirmBody")}</p>
            <div className="mt-4 rounded-lg bg-surface p-4">
              <div className="text-sm text-muted">
                {t("emergency.localNumber")}
              </div>
              <a
                href={`tel:${reg.emergencyNumber}`}
                className="mt-1 block text-3xl font-bold text-danger"
              >
                {reg.emergencyNumber}
              </a>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {reg.supportOrgs.map((o) => (
                <a
                  key={o.name}
                  href={o.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline text-ink hover:text-accent"
                >
                  {o.name}
                </a>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setArmed(false)}
                className="px-4 py-2 rounded-md text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
