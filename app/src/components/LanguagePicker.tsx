"use client";

import { useTranslation } from "react-i18next";
import { useAppStore } from "@/state/store";

const LANGS: { id: string; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
];

export function LanguagePicker() {
  const { i18n } = useTranslation();
  const setLocale = useAppStore((s) => s.setLocale);
  const current = i18n.language?.slice(0, 2) ?? "en";

  return (
    <label className="block">
      <span className="text-sm text-muted">Language</span>
      <select
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          setLocale(v);
          void i18n.changeLanguage(v);
        }}
        className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {LANGS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
