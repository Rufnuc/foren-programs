/**
 * Frontend wrapper around the proof Web Worker. snarkjs proof generation
 * is CPU-heavy (multi-second on mobile); running it on the main thread
 * would freeze the UI. The worker reuses the same `prove.ts` helpers from
 * `circuits/scripts/prove.ts` ported to a self-contained worker module.
 */

export interface ProofRequest {
  contentHash: Uint8Array;
  slot: bigint;
  slotMin: bigint;
  slotMax: bigint;
  lat: bigint;
  lon: bigint;
  locSalt: Uint8Array;
  /** Public path to evidence_zk.wasm — usually "/zk/evidence_zk.wasm". */
  wasmUrl: string;
  /** Public path to evidence_zk_final.zkey. */
  zkeyUrl: string;
}

export interface ProofResponse {
  proof: { pi_a: any; pi_b: any; pi_c: any };
  publicSignals: string[];
}

export class ProofClient {
  private worker: Worker | null = null;

  start() {
    if (this.worker) return;
    this.worker = new Worker(new URL("../workers/prove.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
  }

  prove(req: ProofRequest): Promise<ProofResponse> {
    this.start();
    return new Promise((resolve, reject) => {
      const w = this.worker!;
      const handler = (ev: MessageEvent) => {
        w.removeEventListener("message", handler);
        if (ev.data.ok) resolve(ev.data.result as ProofResponse);
        else reject(new Error(ev.data.error || "proof failed"));
      };
      w.addEventListener("message", handler);
      // Convert BigInts to strings for the postMessage hop.
      w.postMessage({
        ...req,
        slot: req.slot.toString(),
        slotMin: req.slotMin.toString(),
        slotMax: req.slotMax.toString(),
        lat: req.lat.toString(),
        lon: req.lon.toString(),
      });
    });
  }
}
