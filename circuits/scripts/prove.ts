/**
 * Helpers for producing Groth16 witnesses and proofs for the Prutet circuit
 * from regular JS values (Solana slot, lat/lon scaled to micro-degrees, the
 * raw 32-byte SHA-256 of the encrypted blob, …).
 *
 * The proof is generated with `snarkjs.groth16.fullProve`, which combines
 * witness generation (via the wasm) and proving (via the zkey) in one call.
 * It is fast enough for both Node tests and a Web Worker in the frontend.
 */
import * as fs from "fs";
import * as path from "path";
// snarkjs is JS-only; types are not exported. Import as `any`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs: any = require("snarkjs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const circomlibjs: any = require("circomlibjs");

import { packProof, SolanaProof } from "./export_vk_solana";

/** Inputs the caller must supply (all numbers/bigints in their natural form). */
export interface EvidenceInputs {
  /** 32-byte SHA-256 of the encrypted evidence blob. */
  contentHash: Buffer;
  /** Solana slot the hash was anchored at. */
  slot: bigint;
  /** Lower bound of the disclosed slot range. */
  slotMin: bigint;
  /** Upper bound of the disclosed slot range. */
  slotMax: bigint;
  /** Latitude scaled to micro-degrees (lat * 1e6, rounded) — fits in i64. */
  lat: bigint;
  /** Longitude scaled to micro-degrees. */
  lon: bigint;
  /** 32-byte salt — random per evidence. */
  locSalt: Buffer;
}

/** Witness fed to `evidence_zk.circom`, all stringified BigInts. */
export interface CircomWitness {
  slot_min: string;
  slot_max: string;
  location_commitment: string;
  nullifier: string;
  content_hash_lo: string;
  content_hash_hi: string;
  slot: string;
  lat: string;
  lon: string;
  loc_salt: string;
}

/** Big-endian buffer → BigInt. */
export function bufBE(b: Buffer): bigint {
  return BigInt("0x" + b.toString("hex"));
}

/** Split a 32-byte SHA-256 into two 128-bit limbs (high, low) as BigInts. */
export function splitHash256(hash: Buffer): { lo: bigint; hi: bigint } {
  if (hash.length !== 32) throw new Error(`hash must be 32 bytes, got ${hash.length}`);
  const hi = bufBE(hash.subarray(0, 16));
  const lo = bufBE(hash.subarray(16, 32));
  return { lo, hi };
}

let _poseidonPromise: Promise<any> | null = null;
async function getPoseidon() {
  if (!_poseidonPromise) _poseidonPromise = circomlibjs.buildPoseidon();
  return _poseidonPromise;
}

/** Compute the public commitments (nullifier + location_commitment). */
export async function computePublics(inputs: EvidenceInputs) {
  const poseidon = await getPoseidon();
  const F = poseidon.F;

  const { lo, hi } = splitHash256(inputs.contentHash);
  const nullifier = F.toObject(poseidon([lo, hi])) as bigint;

  const salt = bufBE(inputs.locSalt);
  const locationCommitment = F.toObject(
    poseidon([inputs.lat, inputs.lon, salt]),
  ) as bigint;

  return { nullifier, locationCommitment, contentHashLo: lo, contentHashHi: hi, salt };
}

/** Build the full circom witness object from `EvidenceInputs`. */
export async function buildWitness(inputs: EvidenceInputs): Promise<CircomWitness> {
  const { nullifier, locationCommitment, contentHashLo, contentHashHi, salt } =
    await computePublics(inputs);

  return {
    slot_min: inputs.slotMin.toString(),
    slot_max: inputs.slotMax.toString(),
    location_commitment: locationCommitment.toString(),
    nullifier: nullifier.toString(),
    content_hash_lo: contentHashLo.toString(),
    content_hash_hi: contentHashHi.toString(),
    slot: inputs.slot.toString(),
    lat: inputs.lat.toString(),
    lon: inputs.lon.toString(),
    loc_salt: salt.toString(),
  };
}

/** Run the full prover and return raw snarkjs outputs. */
export async function generateProof(
  inputs: EvidenceInputs,
  wasmPath: string,
  zkeyPath: string,
) {
  const witness = await buildWitness(inputs);
  return snarkjs.groth16.fullProve(witness, wasmPath, zkeyPath) as Promise<{
    proof: { pi_a: any; pi_b: any; pi_c: any };
    publicSignals: string[];
  }>;
}

/** Convenience wrapper: produce a Solana-ready proof in one call. */
export async function generateSolanaProof(
  inputs: EvidenceInputs,
  wasmPath: string,
  zkeyPath: string,
): Promise<{
  solana: SolanaProof;
  publicSignals: string[];
  raw: { pi_a: any; pi_b: any; pi_c: any };
}> {
  const { proof, publicSignals } = await generateProof(inputs, wasmPath, zkeyPath);
  return {
    solana: packProof(proof, publicSignals),
    publicSignals,
    raw: proof,
  };
}

/** Default artefact paths inside the workspace. */
export const ARTEFACTS = {
  wasm: path.join(__dirname, "..", "build", "evidence_zk_js", "evidence_zk.wasm"),
  zkey: path.join(__dirname, "..", "keys", "evidence_zk_final.zkey"),
  vkJson: path.join(__dirname, "..", "keys", "evidence_zk_vk.json"),
  vkSolana: path.join(__dirname, "..", "keys", "evidence_zk_vk_solana.json"),
};

export function artefactsExist(): boolean {
  return (
    fs.existsSync(ARTEFACTS.wasm) &&
    fs.existsSync(ARTEFACTS.zkey) &&
    fs.existsSync(ARTEFACTS.vkJson)
  );
}
