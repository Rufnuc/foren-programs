/**
 * Hand-typed IDL constant for the `evidence_anchor` program. Mirrors
 * `programs/evidence_anchor/src/lib.rs` exactly. After making any change
 * to the on-chain program, regenerate this from `target/idl/evidence_anchor.json`
 * (or copy with `yarn workspace @prutet/app sync-idl` once Phase 5 lands).
 */
import type { Idl } from "@coral-xyz/anchor";

export const EVIDENCE_ANCHOR_IDL = {
  version: "0.1.0",
  name: "evidence_anchor",
  instructions: [
    {
      name: "anchorHash",
      accounts: [
        { name: "record", isMut: true, isSigner: false },
        { name: "signer", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "nonce", type: "u64" },
        { name: "hash", type: { array: ["u8", 32] } },
        { name: "locationCommitment", type: { array: ["u8", 32] } },
      ],
    },
    {
      name: "revokeAnchor",
      accounts: [
        { name: "record", isMut: true, isSigner: false },
        { name: "signer", isMut: false, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "anchorRecord",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "hash", type: { array: ["u8", 32] } },
          { name: "locationCommitment", type: { array: ["u8", 32] } },
          { name: "timestamp", type: "i64" },
          { name: "slot", type: "u64" },
          { name: "nonce", type: "u64" },
          { name: "revoked", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  events: [
    {
      name: "EvidenceAnchored",
      fields: [
        { name: "owner", type: "publicKey", index: false },
        { name: "hash", type: { array: ["u8", 32] }, index: false },
        { name: "slot", type: "u64", index: false },
        { name: "timestamp", type: "i64", index: false },
        { name: "nonce", type: "u64", index: false },
      ],
    },
    {
      name: "AnchorRevoked",
      fields: [
        { name: "owner", type: "publicKey", index: false },
        { name: "hash", type: { array: ["u8", 32] }, index: false },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: "Unauthorized",
      msg: "Signer is not the owner of this anchor record.",
    },
  ],
} as const satisfies Idl;
