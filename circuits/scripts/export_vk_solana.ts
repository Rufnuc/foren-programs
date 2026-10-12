/**
 * Repack a snarkjs Groth16 verifying key (`*_vk.json`) and proofs into the
 * byte layout expected by `programs/zk_verifier`:
 *
 *   G1 = x ‖ y                        (32 + 32 = 64 bytes, big-endian)
 *   G2 = x.c1 ‖ x.c0 ‖ y.c1 ‖ y.c0    (4 × 32 = 128 bytes, Ethereum order)
 *
 * Public inputs are 32-byte big-endian encodings of bn254 Fr elements.
 *
 * CLI:
 *   ts-node export_vk_solana.ts <vk.json> <out.json>
 */
import * as fs from "fs";

export type Hex = string; // lowercase hex without "0x"

/** Encode a decimal/string field element as a 32-byte big-endian Buffer. */
export function feToBytes(s: string): Buffer {
  const v = BigInt(s);
  if (v < 0n) throw new Error(`negative field element: ${s}`);
  let hex = v.toString(16);
  if (hex.length > 64) throw new Error(`field element does not fit in 32 bytes: ${s}`);
  hex = hex.padStart(64, "0");
  return Buffer.from(hex, "hex");
}

/** snarkjs G1 point in projective form `[x, y, z]`, all decimal strings. */
export type SnarkG1 = [string, string, string];

/** snarkjs G2 point: `[[x.c0, x.c1], [y.c0, y.c1], [z.c0, z.c1]]`. */
export type SnarkG2 = [[string, string], [string, string], [string, string]];

export function g1ToBytes(p: SnarkG1): Buffer {
  // Drop the projective z (snarkjs always emits affine with z = 1).
  return Buffer.concat([feToBytes(p[0]), feToBytes(p[1])]);
}

export function g2ToBytes(p: SnarkG2): Buffer {
  // Solana / Ethereum precompile order: x.c1 ‖ x.c0 ‖ y.c1 ‖ y.c0
  return Buffer.concat([
    feToBytes(p[0][1]),
    feToBytes(p[0][0]),
    feToBytes(p[1][1]),
    feToBytes(p[1][0]),
  ]);
}

export interface SolanaVk {
  alpha_g1: Buffer;      // 64
  beta_g2: Buffer;       // 128
  gamma_g2: Buffer;      // 128
  delta_g2: Buffer;      // 128
  ic: Buffer[];          // each 64
}

export function loadVk(vkPath: string): SolanaVk {
  const vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));
  if (vk.protocol !== "groth16" || vk.curve !== "bn128") {
    throw new Error(
      `unsupported VK: protocol=${vk.protocol} curve=${vk.curve} (need groth16/bn128)`,
    );
  }
  return {
    alpha_g1: g1ToBytes(vk.vk_alpha_1 as SnarkG1),
    beta_g2: g2ToBytes(vk.vk_beta_2 as SnarkG2),
    gamma_g2: g2ToBytes(vk.vk_gamma_2 as SnarkG2),
    delta_g2: g2ToBytes(vk.vk_delta_2 as SnarkG2),
    ic: (vk.IC as SnarkG1[]).map(g1ToBytes),
  };
}

export interface SolanaProof {
  proof_a: Buffer;            // 64
  proof_b: Buffer;            // 128
  proof_c: Buffer;            // 64
  public_inputs: Buffer[];    // each 32
}

export function loadProof(proofPath: string, publicSignalsPath: string): SolanaProof {
  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const publics = JSON.parse(fs.readFileSync(publicSignalsPath, "utf8")) as string[];
  return packProof(proof, publics);
}

export function packProof(
  proof: { pi_a: SnarkG1; pi_b: SnarkG2; pi_c: SnarkG1 },
  publicSignals: string[],
): SolanaProof {
  return {
    proof_a: g1ToBytes(proof.pi_a),
    proof_b: g2ToBytes(proof.pi_b),
    proof_c: g1ToBytes(proof.pi_c),
    public_inputs: publicSignals.map(feToBytes),
  };
}

if (require.main === module) {
  const [, , vkPath, outPath] = process.argv;
  if (!vkPath || !outPath) {
    console.error("usage: ts-node export_vk_solana.ts <vk.json> <out.json>");
    process.exit(1);
  }
  const vk = loadVk(vkPath);
  const json = {
    alpha_g1: vk.alpha_g1.toString("hex"),
    beta_g2: vk.beta_g2.toString("hex"),
    gamma_g2: vk.gamma_g2.toString("hex"),
    delta_g2: vk.delta_g2.toString("hex"),
    ic: vk.ic.map((b) => b.toString("hex")),
  };
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
  console.log(`Wrote Solana-packed VK (${vk.ic.length} IC entries) → ${outPath}`);
}
