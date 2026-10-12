#!/usr/bin/env bash
#
# Compile the Prutet circuit and run a single-contributor Groth16 ceremony so
# that local tests have a usable zkey. NEVER use these keys for production.
#
set -euo pipefail

CIRCUIT_NAME="evidence_zk"
HERE="$(cd "$(dirname "$0")" && pwd)"
CIRCUITS_DIR="$(cd "$HERE/.." && pwd)"
BUILD="$CIRCUITS_DIR/build"
PTAU="$CIRCUITS_DIR/ptau"
KEYS="$CIRCUITS_DIR/keys"
mkdir -p "$BUILD" "$PTAU" "$KEYS"

# circomlib lives in node_modules at the workspace root after `yarn install`.
NM_LOCAL="$CIRCUITS_DIR/node_modules"
NM_ROOT="$(cd "$CIRCUITS_DIR/.." && pwd)/node_modules"

# Resolve circom binary: prefer a locally-installed v2 binary on PATH.
if ! command -v circom >/dev/null 2>&1; then
  echo "ERROR: circom not found on PATH. Install with:" >&2
  echo "  cargo install --locked --git https://github.com/iden3/circom.git --tag v2.1.6" >&2
  exit 1
fi

# ----- Phase 1: powers of tau (dev only) -----------------------------------
PTAU_FINAL="$PTAU/pot14_final.ptau"
if [ ! -f "$PTAU_FINAL" ]; then
  echo "==> Phase 1 ceremony (powers of tau, 2^14)"
  npx --yes snarkjs powersoftau new bn128 14 \
    "$PTAU/pot14_0000.ptau" -v
  npx --yes snarkjs powersoftau contribute \
    "$PTAU/pot14_0000.ptau" "$PTAU/pot14_0001.ptau" \
    --name="prutet-dev" -v -e="prutet local entropy $(date +%s%N)"
  npx --yes snarkjs powersoftau prepare phase2 \
    "$PTAU/pot14_0001.ptau" "$PTAU_FINAL" -v
  rm -f "$PTAU/pot14_0000.ptau" "$PTAU/pot14_0001.ptau"
fi

# ----- Compile circuit -----------------------------------------------------
echo "==> Compiling $CIRCUIT_NAME"
circom "$CIRCUITS_DIR/${CIRCUIT_NAME}.circom" \
  --r1cs --wasm --sym \
  -o "$BUILD" \
  -l "$NM_LOCAL" -l "$NM_ROOT"

# ----- Phase 2: Groth16 setup ---------------------------------------------
echo "==> Groth16 setup"
npx --yes snarkjs groth16 setup \
  "$BUILD/${CIRCUIT_NAME}.r1cs" \
  "$PTAU_FINAL" \
  "$KEYS/${CIRCUIT_NAME}_0000.zkey"

npx --yes snarkjs zkey contribute \
  "$KEYS/${CIRCUIT_NAME}_0000.zkey" \
  "$KEYS/${CIRCUIT_NAME}_final.zkey" \
  --name="prutet-dev" -v -e="prutet zkey entropy $(date +%s%N)"
rm -f "$KEYS/${CIRCUIT_NAME}_0000.zkey"

echo "==> Exporting verifying key"
npx --yes snarkjs zkey export verificationkey \
  "$KEYS/${CIRCUIT_NAME}_final.zkey" \
  "$KEYS/${CIRCUIT_NAME}_vk.json"

echo "==> Repacking VK for Solana"
npx --yes ts-node "$HERE/export_vk_solana.ts" \
  "$KEYS/${CIRCUIT_NAME}_vk.json" \
  "$KEYS/${CIRCUIT_NAME}_vk_solana.json"

echo "==> Build complete. Artefacts:"
echo "    wasm:   $BUILD/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
echo "    zkey:   $KEYS/${CIRCUIT_NAME}_final.zkey"
echo "    vk:     $KEYS/${CIRCUIT_NAME}_vk.json"
echo "    vk(sol):$KEYS/${CIRCUIT_NAME}_vk_solana.json"
