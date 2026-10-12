# Prutet

> Privacy-first, blockchain-anchored evidence vault for personal safety.

Prutet lets people quickly capture and seal evidence (photo, video, audio,
text) so that its existence and timestamp can be proved later — without ever
exposing the content or the user's identity. Evidence is encrypted on-device,
its hash is anchored on Solana, and the user can selectively disclose facts
about it via zero-knowledge proofs. At any time the user can permanently burn
their on-chain identity, exercising the GDPR right to erasure while leaving
the integrity of the anchor intact.

## Repository layout

```
forenlabs-prutet/
├── programs/                # Anchor (Rust) on-chain programs
│   ├── evidence_anchor/     # Anchors content hashes (PDA per nonce)
│   └── zk_verifier/         # Groth16 verifier using alt_bn128 syscalls
├── circuits/                # circom circuits + build scripts (Phase 2)
├── relay/                   # Express server: IPFS pin + emergency relay (Phase 3)
├── app/                     # Next.js PWA frontend (Phase 4)
├── tests/                   # Anchor program integration tests (TS / mocha)
├── migrations/              # Anchor deploy scripts
├── docs/                    # Architecture notes
├── Anchor.toml
├── Cargo.toml               # Rust workspace root
├── package.json             # JS workspace root (tests, relay, app)
└── tsconfig.json            # Shared TS config for tests
```

## Build status

This repository is being delivered in phases. The phase you are looking at is
indicated by the most recently committed files.

| Phase | Scope                                                                   | Status |
| ----- | ----------------------------------------------------------------------- | ------ |
| 1     | Repo scaffold + `evidence_anchor` + `zk_verifier` Anchor programs + TS tests | ✅ shipped |
| 2     | `circom` circuit, Groth16 keygen, snarkjs glue, e2e on-chain proof test | ✅ shipped |
| 3     | Express relay (IPFS pin proxy, emergency dispatcher) + tests            | ✅ shipped |
| 4     | Next.js PWA frontend (capture, anchor, proof, burn, i18n)               | ✅ shipped |
| 5     | docker-compose, full-stack glue, polish                                 | ✅ shipped |

### Building the circuits

```bash
# Once: install circom 2 (Rust binary) and JS deps
cargo install --locked --git https://github.com/iden3/circom.git --tag v2.1.6
yarn install

# Compile circuit + run dev Groth16 ceremony + export VK
yarn build:circuits
```

After that, `anchor test` runs both the Phase-1 plumbing tests and the
Phase-2 end-to-end Groth16 test in `tests/zk_verifier_e2e.ts`. If the
circuit artefacts are missing the e2e test skips itself with a clear
message rather than failing.

## Prerequisites

| Tool        | Version (tested)        |
| ----------- | ----------------------- |
| Rust        | 1.75+                   |
| Solana CLI  | 1.18.17                 |
| Anchor CLI  | 0.30.1                  |
| Node.js     | 20 LTS                  |
| Yarn        | 1.22 (classic)          |

```bash
# Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.17/install)"

# Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1 && avm use 0.30.1
```

## First-time setup

```bash
# 1. Generate program keypairs and sync IDs into source.
anchor keys sync

# 2. Install JS deps (root workspace).
yarn install

# 3. Local test validator + run tests.
solana-test-validator --reset &        # in another shell
anchor build
anchor deploy --provider.cluster localnet
anchor test --skip-local-validator
```

> The `declare_id!` strings checked into source are placeholders. `anchor keys
> sync` will replace them with the real IDs derived from the keypairs in
> `target/deploy/`.

## Anchor programs

### `evidence_anchor`

Anchors a 32-byte content hash to Solana. Each call writes a PDA at
`[b"anchor", signer, nonce_le]` containing:

| Field                | Type        | Notes                                       |
| -------------------- | ----------- | ------------------------------------------- |
| `owner`              | `Pubkey`    | The (random, identity-free) signer key.     |
| `hash`               | `[u8; 32]`  | SHA-256 of the encrypted blob.              |
| `location_commitment`| `[u8; 32]`  | Optional Poseidon/Pedersen commitment.      |
| `timestamp`          | `i64`       | `Clock::unix_timestamp` at anchor time.     |
| `slot`               | `u64`       | `Clock::slot` at anchor time.               |
| `nonce`              | `u64`       | Per-user counter, makes PDA unique.         |
| `revoked`            | `bool`      | Soft-revocation flag (best-effort).         |

Instructions: `anchor_hash(nonce, hash, location_commitment)` and
`revoke_anchor()`.

### `zk_verifier`

Verifies a Groth16 proof on-chain using Solana's native alt_bn128 syscalls
(`alt_bn128_addition`, `alt_bn128_multiplication`, `alt_bn128_pairing`). The
verifying key is stored in a PDA at `[b"vk", authority]` so the same program
can host multiple circuits. Phase 2 will provide a circom circuit whose VK
populates this account at deploy time.

Instructions: `init_vk(...)` and `verify_proof(proof_a, proof_b, proof_c, public_inputs)`.

## Testing

```bash
anchor test                  # Spawns its own validator + runs tests/*.ts
yarn test:anchor             # Same, via package.json
```

## Security stance

- No PII, email, or phone is stored on-chain. The user's "identity" is a
  random Solana keypair generated on first launch and held only on-device.
- All evidence is encrypted client-side (Argon2id-derived key + AES-GCM)
  before being uploaded to IPFS. The relay sees opaque ciphertext only.
- "Burning" an identity = deleting the local keypair. After burn, on-chain
  anchors remain immutable but unlinkable to any real-world identity unless
  the user voluntarily produces a ZK proof.
- The relay is designed as a zero-knowledge service. Its threat model and
  CSP/headers config are documented in `docs/`.

## Running the full stack locally (docker-compose)

```bash
# Bring up Solana validator + IPFS daemon + relay + frontend.
docker compose up --build

# Frontend:   http://localhost:3000
# Relay:      http://localhost:4000  (livez/readyz)
# Solana RPC: http://localhost:8899
# IPFS API:   http://localhost:5001  (Kubo)
```

The compose file is dev-only: it deliberately runs `solana-test-validator
--reset` and the IPFS daemon as singletons with no auth. For staging or
production, replace the validator with a real cluster (devnet/mainnet),
swap the local IPFS daemon for a pinning provider (`web3.storage`/Pinata)
via the relay's `PINNING_PROVIDER` env, and put the relay behind TLS.

## Trusted setup

Groth16 requires a circuit-specific trusted setup. See
[`docs/TRUSTED_SETUP.md`](docs/TRUSTED_SETUP.md) for the production
ceremony procedure (multi-contributor, public beacon, toxic-waste
destruction). The dev keys produced by `yarn build:circuits` are **not**
safe for any production deployment.

## License

TBD (to be chosen by the maintainer before public release).
