/**
 * Tiny client for the Prutet relay. Every call is fail-soft: if the relay
 * is unreachable, the caller can decide whether to queue the work for
 * later (evidence pinning) or surface the failure (emergency dispatch).
 */

const RELAY_BASE = process.env.NEXT_PUBLIC_RELAY_URL ?? "http://127.0.0.1:4000";

export interface PinResult {
  cid: string;
  size: number;
  pinnedAt: number;
}

/** Pin a pre-encrypted blob. The relay never sees plaintext. */
export async function pinBlob(blob: Uint8Array): Promise<PinResult> {
  const res = await fetch(`${RELAY_BASE}/v1/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(`pin failed: ${res.status}`);
  return res.json();
}

export type EmergencyChannel = "sms" | "email";

export interface EmergencyRecipient {
  channel: EmergencyChannel;
  to: string;
}

export interface DispatchResult {
  dispatched: number;
  failures: { channel: EmergencyChannel; to_hash: string; error?: string }[];
}

export async function dispatchEmergency(
  recipients: EmergencyRecipient[],
  payload: { ciphertext: string; subject?: string },
): Promise<DispatchResult> {
  const res = await fetch(`${RELAY_BASE}/v1/emergency/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipients, payload }),
  });
  if (res.status >= 500) throw new Error(`relay error: ${res.status}`);
  return res.json();
}

export async function relayReady(): Promise<boolean> {
  try {
    const res = await fetch(`${RELAY_BASE}/livez`);
    return res.ok;
  } catch {
    return false;
  }
}
