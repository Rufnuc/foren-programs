//! Prutet — `evidence_anchor`
//!
//! Anchors a 32-byte content hash to Solana. The PDA stores the hash, an
//! optional location commitment, the slot/timestamp it was anchored at, the
//! signing pubkey (a random keypair, no PII), and a per-user nonce.
//!
//! True erasure is achieved off-chain by destroying the user's keypair. The
//! optional `revoke_anchor` instruction only flips a public flag for clients
//! that wish to advertise revocation; the hash itself is never deleted.

use anchor_lang::prelude::*;

declare_id!("8VoTsviK9uW9viwZRXoPcYj47SdKaadchj5kdDfcghYB");

#[program]
pub mod evidence_anchor {
    use super::*;

    /// Anchor a content hash. The PDA seeds are
    /// `[b"anchor", signer, nonce_le]` so a single user can scan all of their
    /// anchors by deriving them with their own pubkey.
    pub fn anchor_hash(
        ctx: Context<AnchorHash>,
        nonce: u64,
        hash: [u8; 32],
        location_commitment: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        let record = &mut ctx.accounts.record;

        record.owner = ctx.accounts.signer.key();
        record.hash = hash;
        record.location_commitment = location_commitment;
        record.timestamp = clock.unix_timestamp;
        record.slot = clock.slot;
        record.nonce = nonce;
        record.revoked = false;
        record.bump = ctx.bumps.record;

        emit!(EvidenceAnchored {
            owner: record.owner,
            hash,
            slot: record.slot,
            timestamp: record.timestamp,
            nonce,
        });

        Ok(())
    }

    /// Best-effort revocation flag. Real unlinking comes from destroying the
    /// keypair off-chain; this instruction simply marks the public record so
    /// indexers/UIs can hide it.
    pub fn revoke_anchor(ctx: Context<RevokeAnchor>) -> Result<()> {
        let record = &mut ctx.accounts.record;
        require_keys_eq!(
            record.owner,
            ctx.accounts.signer.key(),
            AnchorErr::Unauthorized
        );
        record.revoked = true;
        emit!(AnchorRevoked {
            owner: record.owner,
            hash: record.hash,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct AnchorHash<'info> {
    #[account(
        init,
        payer = signer,
        space = AnchorRecord::SIZE,
        seeds = [b"anchor", signer.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub record: Account<'info, AnchorRecord>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAnchor<'info> {
    #[account(
        mut,
        seeds = [b"anchor", signer.key().as_ref(), &record.nonce.to_le_bytes()],
        bump = record.bump
    )]
    pub record: Account<'info, AnchorRecord>,
    pub signer: Signer<'info>,
}

#[account]
pub struct AnchorRecord {
    pub owner: Pubkey,                 // 32
    pub hash: [u8; 32],                // 32
    pub location_commitment: [u8; 32], // 32  (Poseidon/Pedersen, optional)
    pub timestamp: i64,                //  8
    pub slot: u64,                     //  8
    pub nonce: u64,                    //  8
    pub revoked: bool,                 //  1
    pub bump: u8,                      //  1
}

impl AnchorRecord {
    // 8-byte discriminator + sum of fields above
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[event]
pub struct EvidenceAnchored {
    pub owner: Pubkey,
    pub hash: [u8; 32],
    pub slot: u64,
    pub timestamp: i64,
    pub nonce: u64,
}

#[event]
pub struct AnchorRevoked {
    pub owner: Pubkey,
    pub hash: [u8; 32],
}

#[error_code]
pub enum AnchorErr {
    #[msg("Signer is not the owner of this anchor record.")]
    Unauthorized,
}
