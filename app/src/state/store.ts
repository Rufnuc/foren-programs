"use client";

import { create } from "zustand";
import type { Keypair } from "@solana/web3.js";

import { findRegion, type RegionId } from "@/lib/regions";
import { isOnboarded as readOnboarded } from "@/lib/identity";

type Contrast = "default" | "high";

interface AppState {
  /** Identity status known so far on this device. */
  status: "unknown" | "absent" | "locked" | "unlocked";
  publicKey: string | null;
  keypair: Keypair | null;
  vaultKey: CryptoKey | null;

  locale: string;
  region: RegionId;
  contrast: Contrast;

  hydrate: () => Promise<void>;
  setUnlocked: (id: { keypair: Keypair; publicKey: string; vaultKey: CryptoKey }) => void;
  lock: () => void;
  setLocked: () => void;
  setAbsent: () => void;

  setLocale: (l: string) => void;
  setRegion: (r: RegionId) => void;
  setContrast: (c: Contrast) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: "unknown",
  publicKey: null,
  keypair: null,
  vaultKey: null,
  locale: "en",
  region: "us",
  contrast: "default",

  async hydrate() {
    if (typeof window === "undefined") return;
    // Restore lightweight prefs from localStorage so the first paint is correct.
    const locale = localStorage.getItem("prutet:locale") ?? "en";
    const region = (localStorage.getItem("prutet:region") as RegionId | null) ?? "us";
    const contrast = (localStorage.getItem("prutet:contrast") as Contrast | null) ?? "default";
    document.documentElement.setAttribute("data-contrast", contrast);
    document.documentElement.lang = locale;

    const onboarded = await readOnboarded();
    set({
      locale,
      region: findRegion(region).id,
      contrast,
      status: onboarded ? "locked" : "absent",
    });
  },

  setUnlocked(id) {
    set({
      status: "unlocked",
      keypair: id.keypair,
      publicKey: id.publicKey,
      vaultKey: id.vaultKey,
    });
  },

  lock() {
    set({ status: "locked", keypair: null, vaultKey: null });
  },

  setLocked() {
    set({ status: "locked" });
  },

  setAbsent() {
    set({ status: "absent", keypair: null, vaultKey: null, publicKey: null });
  },

  setLocale(l) {
    if (typeof document !== "undefined") document.documentElement.lang = l;
    if (typeof window !== "undefined") localStorage.setItem("prutet:locale", l);
    set({ locale: l });
  },

  setRegion(r) {
    if (typeof window !== "undefined") localStorage.setItem("prutet:region", r);
    set({ region: r });
  },

  setContrast(c) {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-contrast", c);
    }
    if (typeof window !== "undefined") localStorage.setItem("prutet:contrast", c);
    set({ contrast: c });
  },
}));
