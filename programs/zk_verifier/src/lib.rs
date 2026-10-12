//! Prutet — `zk_verifier`
//!
//! Verifies a Groth16 proof on-chain using Solana's native alt_bn128 syscalls
//! (`alt_bn128_addition`, `alt_bn128_multiplication`, `alt_bn128_pairing`).
//!
//! Verifying-key layout follows snarkjs / circom conventions:
//!     - alpha:  G1 (64 bytes, x||y, big-endian)
//!     - beta:   G2 (128 bytes)
//!     - gamma:  G2 (128 bytes)
//!     - delta:  G2 (128 bytes)
//!     - ic:     Vec<G1>  with `public_inputs.len() + 1` entries
//!
//! The pairing check enforced by `verify_proof` is the standard:
//!
//!     e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
//!
//! where `vk_x = ic[0] + Σ ic[i+1] * public_inputs[i]` (G1).

use anchor_lang::prelude::*;
use solana_program::alt_bn128::prelude::{
    alt_bn128_addition, alt_bn128_multiplication, alt_bn128_pairing,
};

declare_id!("Hm5unJFLi9SA8P8vrQWWy3YgfyX21UQGZafpnpedJsT1");

/// bn254 base field modulus, used to negate G1 points (y' = p - y).
const BN254_FQ_MODULUS: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x97, 0x81, 0x6a, 0x91, 0x68, 0x71, 0xca, 0x8d, 0x3c, 0x20, 0x8c, 0x16, 0xd8, 0x7c, 0xfd, 0x47,
];

/// Maximum number of public inputs we are willing to allocate space for.
/// 16 is plenty for the Prutet circuit (hash limbs + slot range +
/// location commitment).
pub const MAX_PUBLIC_INPUTS: usize = 16;

#[program]
pub mod zk_verifier {
    use super::*;

    /// Initialise (or replace) the verifying-key account at
    /// `[b"vk", authority]`.
    pub fn init_vk(
        ctx: Context<InitVk>,
        alpha_g1: [u8; 64],
        beta_g2: [u8; 128],
        gamma_g2: [u8; 128],
        delta_g2: [u8; 128],
        ic: Vec<[u8; 64]>,
    ) -> Result<()> {
        require!(
            ic.len() >= 1 && ic.len() <= MAX_PUBLIC_INPUTS + 1,
            VerifierErr::InvalidVerifyingKey
        );
        let vk = &mut ctx.accounts.vk;
        vk.authority = ctx.accounts.authority.key();
        vk.alpha_g1 = alpha_g1;
        vk.beta_g2 = beta_g2;
        vk.gamma_g2 = gamma_g2;
        vk.delta_g2 = delta_g2;
        vk.ic = ic;
        Ok(())
    }

    /// Verify a Groth16 proof against the stored VK and a vector of
    /// big-endian Fr public inputs.
    pub fn verify_proof(
        ctx: Context<VerifyProof>,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_inputs: Vec<[u8; 32]>,
    ) -> Result<()> {
        let vk = &ctx.accounts.vk;
        require!(
            public_inputs.len() + 1 == vk.ic.len(),
            VerifierErr::InvalidPublicInputCount
        );

        // ---- vk_x = ic[0] + Σ ic[i+1] * public_inputs[i] ---------------------
        let mut vk_x: [u8; 64] = vk.ic[0];
        for (i, scalar) in public_inputs.iter().enumerate() {
            // term = ic[i+1] * scalar  (G1 scalar multiplication)
            let mut mul_input = [0u8; 96];
            mul_input[..64].copy_from_slice(&vk.ic[i + 1]);
            mul_input[64..].copy_from_slice(scalar);
            let term_vec = alt_bn128_multiplication(&mul_input)
                .map_err(|_| error!(VerifierErr::AltBn128Failed))?;
            require!(term_vec.len() == 64, VerifierErr::AltBn128Failed);

            // vk_x = vk_x + term       (G1 point addition)
            let mut add_input = [0u8; 128];
            add_input[..64].copy_from_slice(&vk_x);
            add_input[64..].copy_from_slice(&term_vec);
            let sum_vec = alt_bn128_addition(&add_input)
                .map_err(|_| error!(VerifierErr::AltBn128Failed))?;
            require!(sum_vec.len() == 64, VerifierErr::AltBn128Failed);
            vk_x.copy_from_slice(&sum_vec);
        }

        // ---- pairing input ---------------------------------------------------
        // 4 pairs × (G1 64 + G2 128) = 4 × 192 = 768 bytes
        let neg_a = negate_g1(&proof_a)?;
        let mut pairing_input = Vec::with_capacity(768);
        pairing_input.extend_from_slice(&neg_a);
        pairing_input.extend_from_slice(&proof_b);
        pairing_input.extend_from_slice(&vk.alpha_g1);
        pairing_input.extend_from_slice(&vk.beta_g2);
        pairing_input.extend_from_slice(&vk_x);
        pairing_input.extend_from_slice(&vk.gamma_g2);
        pairing_input.extend_from_slice(&proof_c);
        pairing_input.extend_from_slice(&vk.delta_g2);

        let pairing_result = alt_bn128_pairing(&pairing_input)
            .map_err(|_| error!(VerifierErr::AltBn128Failed))?;

        // alt_bn128_pairing returns 32 bytes big-endian; "1" means valid.
        require!(pairing_result.len() == 32, VerifierErr::AltBn128Failed);
        let mut expected = [0u8; 32];
        expected[31] = 1;
        require!(
            pairing_result.as_slice() == expected.as_slice(),
            VerifierErr::ProofInvalid
        );

        emit!(ProofVerified {
            verifier: ctx.accounts.vk.key(),
            num_public_inputs: public_inputs.len() as u32,
        });
        Ok(())
    }
}

/// Negate a G1 point in uncompressed (x||y, big-endian) form by setting
/// y' = (p - y) mod p.
fn negate_g1(point: &[u8; 64]) -> Result<[u8; 64]> {
    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&point[..32]);

    // Big-endian subtraction: out_y = BN254_FQ_MODULUS - point_y
    let mut borrow: i16 = 0;
    for i in (0..32).rev() {
        let p_i = BN254_FQ_MODULUS[i] as i16;
        let y_i = point[32 + i] as i16;
        let mut diff = p_i - y_i - borrow;
        if diff < 0 {
            diff += 256;
            borrow = 1;
        } else {
            borrow = 0;
        }
        out[32 + i] = diff as u8;
    }
    Ok(out)
}

#[derive(Accounts)]
pub struct InitVk<'info> {
    #[account(
        init,
        payer = authority,
        space = VerifyingKey::MAX_SIZE,
        seeds = [b"vk", authority.key().as_ref()],
        bump
    )]
    pub vk: Account<'info, VerifyingKey>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    pub vk: Account<'info, VerifyingKey>,
}

#[account]
pub struct VerifyingKey {
    pub authority: Pubkey,         //  32
    pub alpha_g1: [u8; 64],        //  64
    pub beta_g2: [u8; 128],        // 128
    pub gamma_g2: [u8; 128],       // 128
    pub delta_g2: [u8; 128],       // 128
    pub ic: Vec<[u8; 64]>,         //   4 + n*64
}

impl VerifyingKey {
    // 8-byte disc + fixed fields + Vec len(4) + (MAX_PUBLIC_INPUTS+1) * 64
    pub const MAX_SIZE: usize =
        8 + 32 + 64 + 128 + 128 + 128 + 4 + (MAX_PUBLIC_INPUTS + 1) * 64;
}

#[event]
pub struct ProofVerified {
    pub verifier: Pubkey,
    pub num_public_inputs: u32,
}

#[error_code]
pub enum VerifierErr {
    #[msg("Verifying key is malformed (IC length out of range).")]
    InvalidVerifyingKey,
    #[msg("Number of public inputs does not match the verifying key.")]
    InvalidPublicInputCount,
    #[msg("alt_bn128 syscall failed (invalid point or pairing input).")]
    AltBn128Failed,
    #[msg("Proof is invalid: pairing check did not return 1.")]
    ProofInvalid,
}
