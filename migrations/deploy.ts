/**
 * Post-deploy bootstrap: seed the on-chain `zk_verifier` VK from the snarkjs
 * verifying-key JSON produced by `circuits/scripts/build.sh`.
 *
 * Anchor invokes this with the configured provider after `anchor deploy`. If
 * the circuit artefacts have not been built yet, the script logs a notice
 * and exits cleanly so plain Anchor deploys still succeed.
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";

import { ARTEFACTS, artefactsExist } from "../circuits/scripts/prove";
import { loadVk } from "../circuits/scripts/export_vk_solana";

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  if (!artefactsExist()) {
    console.log(
      "[deploy] circuit artefacts not built — skipping VK seeding. " +
        "Run `yarn workspace @prutet/circuits build` then re-run deploy.",
    );
    return;
  }

  // The zk_verifier program is in the workspace, picked up by name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = (anchor.workspace as any).ZkVerifier as anchor.Program;
  const authority = provider.wallet.publicKey;

  const [vkPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vk"), authority.toBuffer()],
    program.programId,
  );

  // If a VK is already seeded under this authority, do nothing.
  const existing = await provider.connection.getAccountInfo(vkPda);
  if (existing) {
    console.log(`[deploy] VK PDA already exists at ${vkPda.toBase58()} — skipping.`);
    return;
  }

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
      authority,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  // Persist the VK PDA address so the frontend can read it without scanning.
  const out = {
    cluster: provider.connection.rpcEndpoint,
    authority: authority.toBase58(),
    vk_pda: vkPda.toBase58(),
    program_id: program.programId.toBase58(),
    ic_count: vk.ic.length,
  };
  fs.writeFileSync(
    "circuits/keys/evidence_zk_vk_deploy.json",
    JSON.stringify(out, null, 2),
  );
  console.log(`[deploy] seeded VK at ${vkPda.toBase58()}`);
};
