/// <reference lib="webworker" />

/**
 * Web Worker that produces a Groth16 proof for the Prutet evidence_zk
 * circuit. The main thread sends inputs + URLs to the wasm/zkey assets;
 * the worker fetches them, runs `snarkjs.groth16.fullProve`, and posts the
 * result back.
 *
 * Runs entirely off-main-thread so the UI stays responsive on mobile.
 */
declare const self: DedicatedWorkerGlobalScope;

// snarkjs and circomlibjs ship as CommonJS bundles that work in workers.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs: any = require("snarkjs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const circomlibjs: any = require("circomlibjs");

interface IncomingMessage {
  contentHash: Uint8Array;
  slot: string;
  slotMin: string;
  slotMax: string;
  lat: string;
  lon: string;
  locSalt: Uint8Array;
  wasmUrl: string;
  zkeyUrl: string;
}

function bufBE(b: Uint8Array): bigint {
  let hex = "0x";
  for (const byte of b) hex += byte.toString(16).padStart(2, "0");
  return BigInt(hex);
}

function splitHash256(hash: Uint8Array) {
  if (hash.length !== 32) throw new Error("hash must be 32 bytes");
  return { hi: bufBE(hash.slice(0, 16)), lo: bufBE(hash.slice(16, 32)) };
}

let _poseidon: any = null;
async function getPoseidon() {
  if (!_poseidon) _poseidon = await circomlibjs.buildPoseidon();
  return _poseidon;
}

self.addEventListener("message", async (ev: MessageEvent<IncomingMessage>) => {
  try {
    const m = ev.data;
    const poseidon = await getPoseidon();
    const F = poseidon.F;

    const { lo, hi } = splitHash256(m.contentHash);
    const nullifier = F.toObject(poseidon([lo, hi])) as bigint;
    const salt = bufBE(m.locSalt);
    const locationCommitment = F.toObject(
      poseidon([BigInt(m.lat), BigInt(m.lon), salt]),
    ) as bigint;

    const witness = {
      slot_min: m.slotMin,
      slot_max: m.slotMax,
      location_commitment: locationCommitment.toString(),
      nullifier: nullifier.toString(),
      content_hash_lo: lo.toString(),
      content_hash_hi: hi.toString(),
      slot: m.slot,
      lat: m.lat,
      lon: m.lon,
      loc_salt: salt.toString(),
    };

    const result = await snarkjs.groth16.fullProve(witness, m.wasmUrl, m.zkeyUrl);
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message });
  }
});

export {};
