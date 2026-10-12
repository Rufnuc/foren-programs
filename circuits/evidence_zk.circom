pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * EvidenceZK
 * ----------
 * Selective-disclosure circuit for Prutet.
 *
 * The prover convinces a verifier of three statements without revealing the
 * underlying evidence or the prover's on-chain identity:
 *
 *   1. "I know an evidence preimage whose Poseidon-of-hash equals
 *       a public `nullifier`." This binds the proof to a specific piece of
 *       evidence whose SHA-256 was anchored on Solana, while keeping the raw
 *       hash itself private. (The 256-bit SHA-256 digest is split into two
 *       128-bit limbs that fit comfortably inside the bn254 scalar field.)
 *
 *   2. "The evidence was anchored at a Solana slot in [slot_min, slot_max]."
 *       Slot is u64-bounded; the 64-bit comparator gadget enforces the
 *       inclusive range.
 *
 *   3. "My geo-location commits to a public `location_commitment`."
 *       commitment = Poseidon(lat, lon, salt). The salt prevents brute-force
 *       inversion when the geo-fence is small, and lets the user reuse the
 *       same lat/lon without producing the same commitment twice.
 *
 * Public inputs (in declaration order):
 *   slot_min, slot_max, location_commitment, nullifier
 *
 * Private witnesses:
 *   content_hash_lo, content_hash_hi, slot, lat, lon, loc_salt
 */
template EvidenceZK() {
    // ---- public ---------------------------------------------------------
    signal input slot_min;
    signal input slot_max;
    signal input location_commitment;
    signal input nullifier;

    // ---- private --------------------------------------------------------
    signal input content_hash_lo;   // low  128 bits of SHA-256(content)
    signal input content_hash_hi;   // high 128 bits of SHA-256(content)
    signal input slot;              // Solana slot at which the hash was anchored
    signal input lat;               // signed integer scaled to micro-degrees
    signal input lon;
    signal input loc_salt;

    // (1) nullifier === Poseidon(content_hash_lo, content_hash_hi)
    component pn = Poseidon(2);
    pn.inputs[0] <== content_hash_lo;
    pn.inputs[1] <== content_hash_hi;
    pn.out === nullifier;

    // (2) slot ∈ [slot_min, slot_max]   (u64 range)
    component geMin = GreaterEqThan(64);
    geMin.in[0] <== slot;
    geMin.in[1] <== slot_min;
    geMin.out === 1;

    component leMax = LessEqThan(64);
    leMax.in[0] <== slot;
    leMax.in[1] <== slot_max;
    leMax.out === 1;

    // (3) location_commitment === Poseidon(lat, lon, loc_salt)
    component pl = Poseidon(3);
    pl.inputs[0] <== lat;
    pl.inputs[1] <== lon;
    pl.inputs[2] <== loc_salt;
    pl.out === location_commitment;
}

component main { public [slot_min, slot_max, location_commitment, nullifier] } = EvidenceZK();
