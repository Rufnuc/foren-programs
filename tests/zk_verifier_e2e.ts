/**
 * End-to-end test: real Groth16 proof produced by snarkjs is verified by the
 * on-chain `zk_verifier` program. Skipped automatically if the circuit
 * artefacts have not been built yet (run `yarn workspace @prutet/circuits build`).
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { createHash, randomBytes } from "crypto";

import type { ZkVerifier } from "../target/types/zk_verifier";

import {
  ARTEFACTS,
  artefactsExist,
  generateSolanaProof,
} from "../circuits/scripts/prove";
import { loadVk } from "../circuits/scripts/export_vk_solana";

describe("zk_verifier (e2e Groth16)", function () {
  // Generating a real Groth16 proof can take several seconds.
  this.timeout(120_000);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ZkVerifier as Program<ZkVerifier>;

  let authority: Keypair;
  let vkPda: PublicKey;

  before(function () {
    if (!artefactsExist()) {
      console.warn(
        "[zk_verifier e2e] circuit artefacts missing — skipping. " +
          "Build with `yarn workspace @prutet/circuits build`.",
      );
      this.skip();
    }
  });

  beforeEach(async () => {
    authority = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
    [vkPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vk"), authority.publicKey.toBuffer()],
      program.programId,
    );
  });

  it("loads VK on-chain and accepts a valid proof", async () => {
    // 1. Load and seed the verifying key from the snarkjs JSON.
    const vk = loadVk(ARTEFACTS.vkJson);
    await program.methods
      .initVk(
        Array.from(vk.alpha_g1),
        Array.from(vk.beta_g2),
        Array.from(vk.gamma_g2),
        Array.from(vk.delta_g2),
        vk.ic.map((b) => Array.from(b)),
      )
      .accounts({
        vk: vkPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // 2. Generate a real proof.
    const content = Buffer.from("hello prutet", "utf8");
    const contentHash = createHash("sha256").update(content).digest();
    const { solana } = await generateSolanaProof(
      {
        contentHash,
        slot: 5_000_000n,
        slotMin: 4_000_000n,
        slotMax: 6_000_000n,
        lat: 40_712_800n,
        lon: -74_006_000n,
        locSalt: randomBytes(32),
      },
      ARTEFACTS.wasm,
      ARTEFACTS.zkey,
    );

    // 3. Verify on-chain.
    await program.methods
      .verifyProof(
        Array.from(solana.proof_a),
        Array.from(solana.proof_b),
        Array.from(solana.proof_c),
        solana.public_inputs.map((b) => Array.from(b)),
      )
      .accounts({ vk: vkPda })
      .rpc();
    // No throw === verification passed.
  });

  it("rejects a tampered proof", async () => {
    const vk = loadVk(ARTEFACTS.vkJson);
    await program.methods
      .initVk(
        Array.from(vk.alpha_g1),
        Array.from(vk.beta_g2),
        Array.from(vk.gamma_g2),
        Array.from(vk.delta_g2),
        vk.ic.map((b) => Array.from(b)),
      )
      .accounts({
        vk: vkPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const contentHash = createHash("sha256").update("evidence-A").digest();
    const { solana } = await generateSolanaProof(
      {
        contentHash,
        slot: 10n,
        slotMin: 0n,
        slotMax: 100n,
        lat: 0n,
        lon: 0n,
        locSalt: randomBytes(32),
      },
      ARTEFACTS.wasm,
      ARTEFACTS.zkey,
    );

    // Flip a byte in proof_a — pairing must now fail.
    const tampered = Buffer.from(solana.proof_a);
    tampered[10] ^= 0x01;

    let threw = false;
    try {
      await program.methods
        .verifyProof(
          Array.from(tampered),
          Array.from(solana.proof_b),
          Array.from(solana.proof_c),
          solana.public_inputs.map((b) => Array.from(b)),
        )
        .accounts({ vk: vkPda })
        .rpc();
    } catch (_e) {
      threw = true;
    }
    expect(threw, "tampered proof must be rejected").to.equal(true);
  });
});
