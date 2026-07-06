#!/bin/bash
# Fine-tunes google/gemma-3-1b-it on the Powerball SFT dataset with MLX LoRA,
# stopping early when validation loss rises for PATIENCE consecutive evals.
# Adapted from the proven recipe in ~/development/python/mlx-finetune.
#
# Usage: training/train-lora.sh [patience]
# Env:   MLX_VENV  path to a venv with mlx-lm installed
#        (default: ~/development/python/mlx-finetune/.venv)

set -euo pipefail
cd "$(dirname "$0")/.."

PATIENCE="${1:-3}"
ADAPTER_DIR="training/adapters/powerball-v1"
DATA_DIR="training/data"
LOG_FILE="$ADAPTER_DIR/train.log"
MLX_VENV="${MLX_VENV:-$HOME/development/python/mlx-finetune/.venv}"

if [ ! -f "$MLX_VENV/bin/mlx_lm.lora" ]; then
  echo "mlx-lm not found at $MLX_VENV. Create one with:"
  echo "  uv venv .venv-mlx && uv pip install --python .venv-mlx mlx-lm"
  echo "  MLX_VENV=.venv-mlx training/train-lora.sh"
  exit 1
fi
if [ ! -f "$DATA_DIR/train.jsonl" ]; then
  echo "No dataset found; run: npm run train:dataset"
  exit 1
fi

mkdir -p "$ADAPTER_DIR"
source "$MLX_VENV/bin/activate"

echo "Training gemma-3-1b-it LoRA (early-stop patience $PATIENCE); log: $LOG_FILE"

mlx_lm.lora \
  --model google/gemma-3-1b-it \
  --train \
  --data "$DATA_DIR" \
  --adapter-path "$ADAPTER_DIR" \
  --iters 1000 \
  --batch-size 4 \
  --num-layers 16 \
  --learning-rate 5e-5 \
  --max-seq-length 1024 \
  --mask-prompt \
  --save-every 100 \
  --steps-per-eval 100 \
  --val-batches 25 \
  --seed 42 2>&1 | tee "$LOG_FILE" &

TRAIN_PID=$!

BEST_LOSS=999.0
WORSE_COUNT=0
BEST_ITER=0

while kill -0 $TRAIN_PID 2>/dev/null; do
  sleep 10
  LATEST=$(grep "Val loss" "$LOG_FILE" 2>/dev/null | tail -1) || true
  [ -z "$LATEST" ] && continue
  ITER=$(echo "$LATEST" | grep -o "Iter [0-9]*" | grep -o "[0-9]*")
  LOSS=$(echo "$LATEST" | grep -o "Val loss [0-9.]*" | grep -o "[0-9.]*")
  { [ -z "$LOSS" ] || [ -z "$ITER" ]; } && continue
  [ "$ITER" = "$BEST_ITER" ] && continue

  if python3 -c "exit(0 if $LOSS < $BEST_LOSS else 1)"; then
    BEST_LOSS="$LOSS"; BEST_ITER="$ITER"; WORSE_COUNT=0
    echo "[early-stop] Iter $ITER: new best val loss $LOSS"
  else
    WORSE_COUNT=$((WORSE_COUNT + 1))
    echo "[early-stop] Iter $ITER: val loss $LOSS > best $BEST_LOSS ($WORSE_COUNT/$PATIENCE)"
    if [ "$WORSE_COUNT" -ge "$PATIENCE" ]; then
      echo "EARLY STOPPING at iter $ITER; best val loss $BEST_LOSS at iter $BEST_ITER"
      kill $TRAIN_PID 2>/dev/null; wait $TRAIN_PID 2>/dev/null || true
      echo "{\"earlyStop\": true, \"bestIter\": $BEST_ITER, \"bestValLoss\": $BEST_LOSS}" > "$ADAPTER_DIR/early-stop.json"
      exit 0
    fi
  fi
done
wait $TRAIN_PID 2>/dev/null || true

echo "Training completed; best val loss $BEST_LOSS at iter $BEST_ITER"
echo "{\"earlyStop\": false, \"bestIter\": $BEST_ITER, \"bestValLoss\": $BEST_LOSS}" > "$ADAPTER_DIR/early-stop.json"
