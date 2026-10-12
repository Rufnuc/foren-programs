/**
 * Solana client wrapper. Exposes a small, opinionated surface around the
 * `evidence_anchor` program so the UI never sees raw `web3.js` boilerplate.
 *
 * The user's keypair signs every transaction directly on-device; the
 * relay is *never* in the signing path.
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { EVIDENCE_ANCHOR_IDL } from "@/idl/evidence_anchor";

export interface ChainConfig {
  cluster: "localnet" | "devnet" | "mainnet-beta";
  rpcUrl: string;
  evidenceAnchorProgramId: string;
}

export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  cluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as any) ?? "localnet",
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  evidenceAnchorProgramId:
    process.env.NEXT_PUBLIC_EVIDENCE_ANCHOR_PROGRAM_ID ??
    "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
};

class KeypairWallet implements anchor.Wallet {
  constructor(public payer: Keypair) {}
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if ("partialSign" in tx) (tx as anchor.web3.Transaction).partialSign(this.payer);
    else (tx as anchor.web3.VersionedTransaction).sign([this.payer]);
    return tx;
  }
  async signAllTransactions<
    T extends anchor.web3.Transaction | anchor.web3.VersionedTransaction,
  >(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((t) => this.signTransaction(t)));
  }
}

export function buildClient(keypair: Keypair, chain: ChainConfig = DEFAULT_CHAIN_CONFIG) {
  const connection = new Connection(chain.rpcUrl, "confirmed");
  const wallet = new KeypairWallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    skipPreflight: false,
  });
  const programId = new PublicKey(chain.evidenceAnchorProgramId);
  const program = new anchor.Program(EVIDENCE_ANCHOR_IDL as anchor.Idl, programId, provider);
  return { connection, provider, program, programId };
}

export function deriveAnchorPda(
  programId: PublicKey,
  signer: PublicKey,
  nonce: number | bigint,
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("anchor"), signer.toBuffer(), buf],
    programId,
  );
}

export interface AnchorTxResult {
  signature: string;
  pda: string;
  slot: number;
  timestamp: number;
}

/** Send an `anchor_hash` transaction. Returns the new PDA + tx sig. */
export async function anchorHashOnChain(
  keypair: Keypair,
  args: {
    nonce: number;
    hash: Uint8Array;
    locationCommitment: Uint8Array;
  },
  chain: ChainConfig = DEFAULT_CHAIN_CONFIG,
): Promise<AnchorTxResult> {
  const { program, programId, connection } = buildClient(keypair, chain);
  const [pda] = deriveAnchorPda(programId, keypair.publicKey, args.nonce);

  const sig = await program.methods
    .anchorHash(
      new anchor.BN(args.nonce),
      Array.from(args.hash),
      Array.from(args.locationCommitment),
    )
    .accounts({
      record: pda,
      signer: keypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  // Read back the slot/timestamp the program recorded.
  const acct = await (program.account as any).anchorRecord.fetch(pda);
  return {
    signature: sig,
    pda: pda.toBase58(),
    slot: Number(acct.slot.toString()),
    timestamp: Number(acct.timestamp.toString()),
  };
}

export async function revokeAnchorOnChain(
  keypair: Keypair,
  args: { nonce: number },
  chain: ChainConfig = DEFAULT_CHAIN_CONFIG,
): Promise<string> {
  const { program, programId } = buildClient(keypair, chain);
  const [pda] = deriveAnchorPda(programId, keypair.publicKey, args.nonce);
  return program.methods
    .revokeAnchor()
    .accounts({ record: pda, signer: keypair.publicKey })
    .rpc();
}
