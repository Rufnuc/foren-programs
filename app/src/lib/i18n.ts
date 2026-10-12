"use client";

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";

/**
 * Initialise i18next once on the client. The frontend is rendered as a
 * client component tree (Next.js App Router) so this runs at first import.
 *
 * Adding a new region (`docs/regions.md` covers the procedure):
 *   1. Drop a `<lang>.json` next to en.json with the same keys.
 *   2. Add a region entry to `lib/regions.ts`.
 *   3. Append the lang code to SUPPORTED_LOCALES below.
 */
export const SUPPORTED_LOCALES = ["en", "es", "fr", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
        fr: { translation: fr },
        de: { translation: de },
      },
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
      },
    });
}

export default i18n;
