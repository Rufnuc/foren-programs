import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { createHash, randomBytes } from "crypto";

import type { EvidenceAnchor } from "../target/types/evidence_anchor";

/**
 * Re-derive the PDA used by the program: [b"anchor", signer, nonce_le].
 */
function deriveAnchorPda(
  programId: PublicKey,
  signer: PublicKey,
  nonce: BN,
): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(BigInt(nonce.toString()));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("anchor"), signer.toBuffer(), nonceBuf],
    programId,
  );
}

describe("evidence_anchor", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.EvidenceAnchor as Program<EvidenceAnchor>;

  // Each test gets a fresh, identity-free keypair.
  let user: Keypair;

  beforeEach(async () => {
    user = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  });

  it("anchors a content hash and stores all metadata", async () => {
    const nonce = new BN(1);
    const blob = randomBytes(2048);
    const hash = Array.from(createHash("sha256").update(blob).digest());
    const locationCommitment = Array.from(randomBytes(32));

    const [recordPda] = deriveAnchorPda(
      program.programId,
      user.publicKey,
      nonce,
    );

    await program.methods
      .anchorHash(nonce, hash, locationCommitment)
      .accounts({
        record: recordPda,
        signer: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const record = await program.account.anchorRecord.fetch(recordPda);
    expect(record.owner.toBase58()).to.equal(user.publicKey.toBase58());
    expect(Buffer.from(record.hash)).to.deep.equal(Buffer.from(hash));
    expect(Buffer.from(record.locationCommitment)).to.deep.equal(
      Buffer.from(locationCommitment),
    );
    expect(record.nonce.toString()).to.equal("1");
    expect(record.revoked).to.equal(false);
    expect(record.timestamp.toNumber()).to.be.greaterThan(0);
    expect(record.slot.toNumber()).to.be.greaterThan(0);
  });

  it("supports multiple anchors per user via the nonce", async () => {
    for (let i = 0; i < 3; i++) {
      const nonce = new BN(i);
      const hash = Array.from(randomBytes(32));
      const loc = Array.from(randomBytes(32));
      const [pda] = deriveAnchorPda(program.programId, user.publicKey, nonce);

      await program.methods
        .anchorHash(nonce, hash, loc)
        .accounts({
          record: pda,
          signer: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      const record = await program.account.anchorRecord.fetch(pda);
      expect(record.nonce.toString()).to.equal(i.toString());
    }
  });

  it("rejects a second anchor at the same nonce (PDA already initialised)", async () => {
    const nonce = new BN(7);
    const hash = Array.from(randomBytes(32));
    const loc = Array.from(randomBytes(32));
    const [pda] = deriveAnchorPda(program.programId, user.publicKey, nonce);

    await program.methods
      .anchorHash(nonce, hash, loc)
      .accounts({
        record: pda,
        signer: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    let threw = false;
    try {
      await program.methods
        .anchorHash(nonce, hash, loc)
        .accounts({
          record: pda,
          signer: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    } catch (_e) {
      threw = true;
    }
    expect(threw, "expected re-init at same nonce to fail").to.equal(true);
  });

  it("lets the owner revoke; rejects a revoke from a stranger", async () => {
    const nonce = new BN(99);
    const hash = Array.from(randomBytes(32));
    const loc = Array.from(randomBytes(32));
    const [pda] = deriveAnchorPda(program.programId, user.publicKey, nonce);

    await program.methods
      .anchorHash(nonce, hash, loc)
      .accounts({
        record: pda,
        signer: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Owner revokes — succeeds.
    await program.methods
      .revokeAnchor()
      .accounts({ record: pda, signer: user.publicKey })
      .signers([user])
      .rpc();
    let record = await program.account.anchorRecord.fetch(pda);
    expect(record.revoked).to.equal(true);

    // A stranger cannot revoke another user's anchor — the PDA seeds bind the
    // record to its owner, so the seeds-mismatch fails on-chain.
    const stranger = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      stranger.publicKey,
      anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig, "confirmed");

    let strangerThrew = false;
    try {
      await program.methods
        .revokeAnchor()
        .accounts({ record: pda, signer: stranger.publicKey })
        .signers([stranger])
        .rpc();
    } catch (_e) {
      strangerThrew = true;
    }
    expect(
      strangerThrew,
      "stranger should not be able to revoke another user's anchor",
    ).to.equal(true);
  });
});
