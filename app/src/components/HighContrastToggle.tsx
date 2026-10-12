"use client";

import { useTranslation } from "react-i18next";
import { useAppStore } from "@/state/store";

export function HighContrastToggle() {
  const { t } = useTranslation();
  const contrast = useAppStore((s) => s.contrast);
  const setContrast = useAppStore((s) => s.setContrast);
  const on = contrast === "high";

  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setContrast(on ? "default" : "high")}
      className="inline-flex items-center gap-3 px-3 py-2 rounded-md border border-muted/40 hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block w-10 h-6 rounded-full transition-colors",
          on ? "bg-ink" : "bg-muted/40",
        ].join(" ")}
      >
        <span
          className={[
            "block h-5 w-5 mt-0.5 ml-0.5 rounded-full bg-bg transition-transform",
            on ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </span>
      <span className="text-sm">{t("settings.highContrast")}</span>
    </button>
  );
}
