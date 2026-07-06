#!/bin/bash
# Serves the fine-tuned Powerball model on an OpenAI-compatible endpoint
# (http://localhost:8199/v1/chat/completions) for the /api/slm route.
#
# Env: MLX_VENV      venv with mlx-lm (default: ~/development/python/mlx-finetune/.venv)
#      ADAPTER_PATH  LoRA adapter dir (default: training/adapters/powerball-v1)
#      SLM_PORT      port (default: 8199)

set -euo pipefail
cd "$(dirname "$0")/.."

MLX_VENV="${MLX_VENV:-$HOME/development/python/mlx-finetune/.venv}"
ADAPTER_PATH="${ADAPTER_PATH:-training/adapters/powerball-v1}"
SLM_PORT="${SLM_PORT:-8199}"

if [ ! -f "$MLX_VENV/bin/mlx_lm.server" ]; then
  echo "mlx-lm not found at $MLX_VENV (see training/train-lora.sh header)."
  exit 1
fi
if [ ! -f "$ADAPTER_PATH/adapters.safetensors" ]; then
  echo "No trained adapter at $ADAPTER_PATH; run: npm run train:lora"
  exit 1
fi

source "$MLX_VENV/bin/activate"
exec mlx_lm.server \
  --model google/gemma-3-1b-it \
  --adapter-path "$ADAPTER_PATH" \
  --port "$SLM_PORT"
