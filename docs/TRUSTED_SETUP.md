# Trusted setup (Groth16) for `evidence_zk`

Groth16 requires a circuit-specific trusted setup. The output is a `.zkey`
that the prover uses and a verifying key (`vk.json`) that the on-chain
`zk_verifier` program loads via `init_vk`. **Anyone who knows the toxic
waste from this ceremony can forge proofs**, so the ceremony should be run
by multiple independent contributors and the toxic waste must be destroyed.

The scripts in `circuits/scripts/` automate a *development* ceremony that
is **not** safe for production. This document describes the production
ceremony.

## Phase 1 — universal Powers of Tau

Powers of Tau is universal: any circuit up to a chosen size can reuse the
same `pot.ptau`. Prefer to import an existing, well-attested ceremony
rather than running your own.

Recommended sources (all >100 contributors):

- Hermez Powers of Tau — https://github.com/iden3/snarkjs#7-prepare-phase-2
- Perpetual Powers of Tau — https://github.com/privacy-scaling-explorations/perpetualpowersoftau

Pick a `pot{N}_final.ptau` whose `2^N` ≥ the circuit's constraint count.
For `evidence_zk` (Poseidon + range checks) `2^14` is more than enough.

```bash
# Verify the imported file before using it.
snarkjs powersoftau verify pot14_final.ptau
```

## Phase 2 — circuit-specific ceremony

This is the part that *must* be redone for `evidence_zk`. Each contributor
runs:

```bash
# Contributor n: takes the previous file, adds entropy, writes the next file.
snarkjs zkey contribute \
  evidence_zk_step_${PREV}.zkey \
  evidence_zk_step_${N}.zkey \
  --name="Contributor ${N}" \
  -e="$(head -c 64 /dev/urandom | base64)"

# Then they publish the SHA-256 of the new file and post the file itself
# to a public location (S3, IPFS, GitHub release).
sha256sum evidence_zk_step_${N}.zkey
```

Recommended minimum: 5 independent contributors who do not coordinate on
their entropy. The final contributor runs:

```bash
snarkjs zkey beacon \
  evidence_zk_step_${LAST}.zkey \
  evidence_zk_final.zkey \
  $(cat /path/to/public/randomness/beacon) 10 \
  --name="Final beacon"
```

The public randomness should come from a verifiable source (e.g. a future
Bitcoin block hash, drand, NIST randomness beacon).

## Verify the final key

```bash
snarkjs zkey verify circuits/build/evidence_zk.r1cs pot14_final.ptau evidence_zk_final.zkey
```

A clean exit means: every contribution is well-formed, no contributor
short-circuited the chain, and the resulting key matches the circuit.

## Export and pin the verifying key

```bash
snarkjs zkey export verificationkey evidence_zk_final.zkey evidence_zk_vk.json
yarn ts-node circuits/scripts/export_vk_solana.ts \
  --vk evidence_zk_vk.json \
  --out circuits/build/evidence_zk_vk_solana.bin
```

Then:

1. Commit `evidence_zk_vk.json` and `evidence_zk_vk_solana.bin` to the repo
   alongside their SHA-256 hashes.
2. Pin `evidence_zk_final.zkey` to IPFS so anyone can independently re-run
   the prover.
3. Run `init_vk` against the deployed `zk_verifier` program with the
   Solana-encoded VK.

## Destroying toxic waste

Each contributor must:

- Run the contribution on a freshly booted machine (live USB recommended).
- Keep network disabled while the entropy is in memory.
- Power-cycle the machine and physically destroy any non-volatile storage
  used during the ceremony.
- Publicly attest, with a signed statement, that the toxic waste has been
  destroyed.

If you cannot meet that bar for all contributors, treat the resulting
key as untrusted and use it only for a non-production deployment.

## Rotation

If the trusted setup is compromised (or merely suspected), rotate by:

1. Re-running Phase 2 with new contributors and a new beacon.
2. Calling `init_vk` again with the new VK (the program reuses the same
   PDA, so the old VK is overwritten in place).
3. Republishing the new `.zkey` and asking clients to re-pull.

Anchored hashes in `evidence_anchor` are unaffected by VK rotation; only
new proofs need to be re-generated.
