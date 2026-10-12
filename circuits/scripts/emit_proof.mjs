// Generate a proof and print the /v1/zk/verify request body as JSON.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const WASM = resolve(HERE, "..", "build", "evidence_zk_js", "evidence_zk.wasm");
const ZKEY = resolve(HERE, "..", "keys", "evidence_zk_final.zkey");
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const mod = (x) => ((x % R) + R) % R;
const g1 = (p) => BigInt(p[0]).toString(16).padStart(64, "0") + BigInt(p[1]).toString(16).padStart(64, "0");
const g2 = (p) =>
  BigInt(p[0][1]).toString(16).padStart(64, "0") + BigInt(p[0][0]).toString(16).padStart(64, "0") +
  BigInt(p[1][1]).toString(16).padStart(64, "0") + BigInt(p[1][0]).toString(16).padStart(64, "0");

const poseidon = await circomlibjs.buildPoseidon();
const F = poseidon.F;
const hash = createHash("sha256").update("the quick brown fox jumps over the lazy dog").digest();
const hi = BigInt("0x" + hash.subarray(0, 16).toString("hex"));
const lo = BigInt("0x" + hash.subarray(16, 32).toString("hex"));
const lat = mod(51_507_400n), lon = mod(-127_500n), salt = mod(BigInt("0x" + randomBytes(32).toString("hex")));
const nullifier = F.toObject(poseidon([lo, hi]));
const locationCommitment = F.toObject(poseidon([lat, lon, salt]));

const witness = {
  slot_min: "12000000", slot_max: "13000000",
  location_commitment: locationCommitment.toString(), nullifier: nullifier.toString(),
  content_hash_lo: lo.toString(), content_hash_hi: hi.toString(),
  slot: "12345678", lat: lat.toString(), lon: lon.toString(), loc_salt: salt.toString(),
};
const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, WASM, ZKEY);
console.log(JSON.stringify({
  proof_a: g1(proof.pi_a), proof_b: g2(proof.pi_b), proof_c: g1(proof.pi_c),
  public_inputs: publicSignals,
}));
process.exit(0);
