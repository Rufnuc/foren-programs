// End-to-end ZK proof on devnet:
//   1. generate a Groth16 proof for the Prutet EvidenceZK circuit
//   2. off-chain sanity check with snarkjs
//   3. init_vk on the deployed zk_verifier (idempotent)
//   4. verify_proof on-chain (positive) → must succeed
//   5. verify_proof with a tampered public input → must fail on-chain
//
// Run from circuits/ AFTER `bash scripts/build.sh`:
//   node scripts/zk_e2e_devnet.mjs
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction, clusterApiUrl,
} from "@solana/web3.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS = resolve(HERE, "..", "keys");
const WASM = resolve(HERE, "..", "build", "evidence_zk_js", "evidence_zk.wasm");
const ZKEY = resolve(KEYS, "evidence_zk_final.zkey");
const VK_JSON = resolve(KEYS, "evidence_zk_vk.json");

const ZK_PROGRAM = new PublicKey("Hm5unJFLi9SA8P8vrQWWy3YgfyX21UQGZafpnpedJsT1");
const RELAY_KEYPAIR = resolve(HERE, "..", "..", "relay", ".solana-keypair.json");

// bn254 scalar field modulus (Fr).
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const mod = (x) => ((x % R) + R) % R;
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const feBytes = (dec) => {
  const hex = BigInt(dec).toString(16).padStart(64, "0");
  if (hex.length > 64) throw new Error("fe too big: " + dec);
  return Buffer.from(hex, "hex");
};
const g1 = (p) => Buffer.concat([feBytes(p[0]), feBytes(p[1])]);
const g2 = (p) => Buffer.concat([feBytes(p[0][1]), feBytes(p[0][0]), feBytes(p[1][1]), feBytes(p[1][0])]);

async function main() {
  for (const f of [WASM, ZKEY, VK_JSON]) {
    if (!existsSync(f)) throw new Error("missing build artefact: " + f + " (run scripts/build.sh)");
  }

  // ---- 1. inputs → witness ----------------------------------------------
  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;
  const content = Buffer.from("the quick brown fox jumps over the lazy dog", "utf8");
  const hash = createHash("sha256").update(content).digest();
  const hi = BigInt("0x" + hash.subarray(0, 16).toString("hex"));
  const lo = BigInt("0x" + hash.subarray(16, 32).toString("hex"));
  const slot = 12_345_678n, slotMin = 12_000_000n, slotMax = 13_000_000n;
  const lat = mod(51_507_400n), lon = mod(-127_500n), salt = mod(BigInt("0x" + randomBytes(32).toString("hex")));

  const nullifier = F.toObject(poseidon([lo, hi]));
  const locationCommitment = F.toObject(poseidon([lat, lon, salt]));

  const witness = {
    slot_min: slotMin.toString(), slot_max: slotMax.toString(),
    location_commitment: locationCommitment.toString(), nullifier: nullifier.toString(),
    content_hash_lo: lo.toString(), content_hash_hi: hi.toString(),
    slot: slot.toString(), lat: lat.toString(), lon: lon.toString(), loc_salt: salt.toString(),
  };

  // ---- 2. prove + off-chain verify --------------------------------------
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, WASM, ZKEY);
  const vkJson = JSON.parse(readFileSync(VK_JSON, "utf8"));
  const offchain = await snarkjs.groth16.verify(vkJson, publicSignals, proof);
  console.log("1. off-chain snarkjs verify :", offchain);
  console.log("   public signals           :", publicSignals);
  if (!offchain) throw new Error("off-chain verification failed — bad build");

  // ---- pack VK + proof for the on-chain verifier ------------------------
  const vk = {
    alpha_g1: g1(vkJson.vk_alpha_1), beta_g2: g2(vkJson.vk_beta_2),
    gamma_g2: g2(vkJson.vk_gamma_2), delta_g2: g2(vkJson.vk_delta_2),
    ic: vkJson.IC.map(g1),
  };
  const proofA = g1(proof.pi_a), proofB = g2(proof.pi_b), proofC = g1(proof.pi_c);
  const publicInputs = publicSignals.map(feBytes);

  // ---- 3. connect + init_vk (idempotent) --------------------------------
  const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(RELAY_KEYPAIR, "utf8"))));
  const [vkPda] = PublicKey.findProgramAddressSync([Buffer.from("vk"), authority.publicKey.toBuffer()], ZK_PROGRAM);

  const icLen = Buffer.alloc(4); icLen.writeUInt32LE(vk.ic.length);
  const existingVk = await conn.getAccountInfo(vkPda);
  if (existingVk) {
    console.log("2. init_vk                  : already initialised at", vkPda.toBase58());
  } else {
    const initData = Buffer.concat([disc("init_vk"), vk.alpha_g1, vk.beta_g2, vk.gamma_g2, vk.delta_g2, icLen, ...vk.ic]);
    const initIx = new TransactionInstruction({
      programId: ZK_PROGRAM,
      keys: [
        { pubkey: vkPda, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: initData,
    });
    const sigInit = await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [authority], { commitment: "confirmed" });
    console.log("2. init_vk                  :", sigInit);
    console.log("   vk PDA                   :", vkPda.toBase58());
  }

  // ---- helper to build + send a verify_proof tx -------------------------
  const pubLen = Buffer.alloc(4);
  const sendVerify = async (a, b, c, pubs) => {
    pubLen.writeUInt32LE(pubs.length);
    const data = Buffer.concat([disc("verify_proof"), a, b, c, pubLen, ...pubs]);
    const ix = new TransactionInstruction({
      programId: ZK_PROGRAM,
      keys: [{ pubkey: vkPda, isSigner: false, isWritable: false }],
      data,
    });
    return sendAndConfirmTransaction(conn, new Transaction().add(ix), [authority], { commitment: "confirmed" });
  };

  // ---- 4. positive verify -----------------------------------------------
  const sigOk = await sendVerify(proofA, proofB, proofC, publicInputs);
  console.log("3. verify_proof (valid)     :", sigOk, "→ ACCEPTED on-chain");

  // ---- 5. negative verify (tamper a public input) -----------------------
  const tampered = publicInputs.map((b) => Buffer.from(b));
  tampered[3][31] ^= 0x01; // flip a bit in the nullifier public input
  let rejected = false;
  try {
    await sendVerify(proofA, proofB, proofC, tampered);
  } catch {
    rejected = true;
  }
  console.log("4. verify_proof (tampered)  :", rejected ? "REJECTED on-chain ✓" : "!! ACCEPTED (unexpected)");

  console.log("\nvk account:", `https://explorer.solana.com/address/${vkPda.toBase58()}?cluster=devnet`);
  if (!rejected) throw new Error("tampered proof was accepted — verifier is broken");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
