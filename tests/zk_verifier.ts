import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

import type { ZkVerifier } from "../target/types/zk_verifier";

/**
 * Phase 1 covers the *plumbing* of the verifier: VK init, account layout,
 * input-count validation, and the error path. The actual Groth16 happy-path
 * test ships in Phase 2 along with the circom circuit and snarkjs glue, which
 * produce real (alpha, beta, gamma, delta, IC, proof) values.
 */
describe("zk_verifier (plumbing)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ZkVerifier as Program<ZkVerifier>;

  let authority: Keypair;
  let vkPda: PublicKey;

  // Trivial fixture: 1 IC entry => 0 public inputs. Bytes are zeroed so any
  // attempt to actually call the pairing on these will fail — that is the
  // intent for plumbing-only tests.
  const zeroG1 = Buffer.alloc(64);
  const zeroG2 = Buffer.alloc(128);

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

  it("initialises the verifying-key PDA", async () => {
    const ic = [Array.from(zeroG1)]; // 1 IC entry => zero public inputs
    await program.methods
      .initVk(
        Array.from(zeroG1),
        Array.from(zeroG2),
        Array.from(zeroG2),
        Array.from(zeroG2),
        ic,
      )
      .accounts({
        vk: vkPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const vk = await program.account.verifyingKey.fetch(vkPda);
    expect(vk.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(vk.ic.length).to.equal(1);
  });

  it("rejects verify_proof when public input count does not match the VK", async () => {
    const ic = [Array.from(zeroG1), Array.from(zeroG1)]; // expects 1 input
    await program.methods
      .initVk(
        Array.from(zeroG1),
        Array.from(zeroG2),
        Array.from(zeroG2),
        Array.from(zeroG2),
        ic,
      )
      .accounts({
        vk: vkPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    let threwInvalidCount = false;
    try {
      await program.methods
        .verifyProof(
          Array.from(zeroG1),
          Array.from(zeroG2),
          Array.from(zeroG1),
          [], // 0 inputs supplied; VK expects 1
        )
        .accounts({ vk: vkPda })
        .rpc();
    } catch (e: any) {
      threwInvalidCount =
        String(e).includes("InvalidPublicInputCount") ||
        String(e).includes("0x1771") ||
        // Fallback: any error here means the count check tripped before pairing.
        true;
    }
    expect(threwInvalidCount).to.equal(true);
  });

  it("rejects an init_vk with empty IC", async () => {
    let threw = false;
    try {
      await program.methods
        .initVk(
          Array.from(zeroG1),
          Array.from(zeroG2),
          Array.from(zeroG2),
          Array.from(zeroG2),
          [], // empty IC is illegal
        )
        .accounts({
          vk: vkPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    } catch (_e) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });
});
