/**
 * One-shot demo: takes a fixed set of inputs, generates a proof, verifies it
 * with snarkjs (off-chain sanity check), and prints the Solana-packed proof.
 * Useful for debugging the build pipeline without spinning up a validator.
 *
 * Run after `yarn workspace @prutet/circuits build`:
 *   yarn workspace @prutet/circuits prove:example
 */
import * as fs from "fs";
import { createHash, randomBytes } from "crypto";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs: any = require("snarkjs");

import { ARTEFACTS, artefactsExist, generateSolanaProof } from "./prove";

async function main() {
  if (!artefactsExist()) {
    console.error(
      "Build artefacts missing. Run `yarn workspace @prutet/circuits build` first.",
    );
    process.exit(1);
  }

  const content = Buffer.from("the quick brown fox jumps over the lazy dog", "utf8");
  const contentHash = createHash("sha256").update(content).digest();
  const inputs = {
    contentHash,
    slot: 12_345_678n,
    slotMin: 12_000_000n,
    slotMax: 13_000_000n,
    lat: 51_507_400n,    // London, micro-degrees
    lon: -127_500n,
    locSalt: randomBytes(32),
  };

  const { solana, publicSignals, raw } = await generateSolanaProof(
    inputs,
    ARTEFACTS.wasm,
    ARTEFACTS.zkey,
  );

  // Off-chain sanity check using snarkjs.
  const vk = JSON.parse(fs.readFileSync(ARTEFACTS.vkJson, "utf8"));
  const ok = await snarkjs.groth16.verify(vk, publicSignals, raw);

  console.log(JSON.stringify(
    {
      offchainVerify: ok,
      publicSignals,
      proof: {
        a: solana.proof_a.toString("hex"),
        b: solana.proof_b.toString("hex"),
        c: solana.proof_c.toString("hex"),
      },
      ic_count: solana.public_inputs.length,
    },
    null,
    2,
  ));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
