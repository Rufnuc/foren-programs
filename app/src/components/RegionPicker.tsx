"use client";

import { useTranslation } from "react-i18next";
import { REGIONS, type RegionId } from "@/lib/regions";
import { useAppStore } from "@/state/store";

export function RegionPicker() {
  const { t } = useTranslation();
  const region = useAppStore((s) => s.region);
  const setRegion = useAppStore((s) => s.setRegion);

  return (
    <label className="block">
      <span className="text-sm text-muted">{t("settings.region")}</span>
      <select
        value={region}
        onChange={(e) => setRegion(e.target.value as RegionId)}
        className="mt-1 block w-full rounded-md border border-muted/40 bg-bg px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {REGIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label} — {r.emergencyNumber}
          </option>
        ))}
      </select>
    </label>
  );
}
