# Prutet — Circuits

`evidence_zk.circom` is the selective-disclosure circuit. Build it once with
`yarn workspace @prutet/circuits build`. Outputs land in:

```
circuits/
├── build/                        # circom outputs
│   ├── evidence_zk.r1cs
│   ├── evidence_zk.sym
│   └── evidence_zk_js/
│       ├── evidence_zk.wasm      # used to generate the witness
│       └── ...
├── ptau/
│   └── pot14_final.ptau          # phase-1 powers of tau (dev ceremony)
└── keys/
    ├── evidence_zk_final.zkey    # phase-2 prover key
    ├── evidence_zk_vk.json       # snarkjs verifying key
    └── evidence_zk_vk_solana.json# repacked for the on-chain verifier
```

## What the circuit proves

| Statement                                                  | Public input(s)         | Private witness(es)              |
| ---------------------------------------------------------- | ----------------------- | -------------------------------- |
| `nullifier == Poseidon(hash_lo, hash_hi)`                  | `nullifier`             | `content_hash_lo`, `content_hash_hi` |
| `slot_min ≤ slot ≤ slot_max`                               | `slot_min`, `slot_max`  | `slot`                           |
| `location_commitment == Poseidon(lat, lon, loc_salt)`      | `location_commitment`   | `lat`, `lon`, `loc_salt`         |

`content_hash_lo` and `content_hash_hi` are the low / high 128 bits of the
SHA-256 digest split as bn254 scalars. The full SHA-256 binding (computing
SHA-256 inside the circuit) is intentionally out-of-scope for Phase 2 because
it is several orders of magnitude more expensive; the Poseidon-nullifier
indirection gives the prover a binding handle that is cheap to verify and
still hides the original 256-bit hash from anyone who has not seen it.

## Build prerequisites

```bash
# circom v2 compiler
cargo install --locked --git https://github.com/iden3/circom.git --tag v2.1.6
# snarkjs is installed as an npm dep by `yarn install` at the repo root.
```

## Trust assumptions of the dev keypair

`build.sh` runs an unsafe single-contributor ceremony purely so that local
tests have a working zkey. Before mainnet you must replace it with a
multi-party ceremony output. A `TRUSTED_SETUP.md` will be added in Phase 5
with the production procedure.

## On-chain VK

`scripts/export_vk_solana.ts` repacks the snarkjs JSON VK into the byte
layout that `programs/zk_verifier` expects:

| Curve point   | Bytes        | Order                               |
| ------------- | ------------ | ----------------------------------- |
| `alpha_g1`    | 64           | x ‖ y, big-endian, 32 B each        |
| `beta_g2`     | 128          | x.c1 ‖ x.c0 ‖ y.c1 ‖ y.c0           |
| `gamma_g2`    | 128          | same                                |
| `delta_g2`    | 128          | same                                |
| `IC[i]`       | 64 each      | x ‖ y                               |

The G2 ordering matches Ethereum's `alt_bn128_pairing` precompile, which is
exactly what Solana's `alt_bn128_pairing` syscall consumes.
