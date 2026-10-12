"use client";

import { useEffect, type ReactNode } from "react";
import "@/lib/i18n";
import { useAppStore } from "@/state/store";
import { LockScreen } from "./LockScreen";
import { EmergencyButton } from "./EmergencyButton";

/**
 * Hydrates the store on mount and gates the app behind the lock screen.
 * Must be a client component so we can run WebCrypto + IndexedDB after
 * Next.js streams the server shell.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useAppStore((s) => s.status);
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (status === "unknown") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg text-muted">
        <span className="sr-only">Loading…</span>
      </main>
    );
  }

  if (status === "locked") return <LockScreen />;

  // Absent (no identity yet): the onboarding page is what should show.
  // Unlocked: render the children. We always mount the EmergencyButton
  // when the app is reachable (absent or unlocked) — emergencies don't
  // wait for an unlock.
  return (
    <>
      {children}
      <EmergencyButton />
    </>
  );
}
