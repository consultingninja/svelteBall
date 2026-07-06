# SLM training

Fine-tunes `google/gemma-3-1b-it` with MLX LoRA on the confirmed draw history
so the app can generate picks with a local model instead of the algorithm.
The recipe is lifted from previous work in `~/development/python/mlx-finetune`
(flow-forge project).

Reality check: lottery draws are independent random events — no model can
predict them. What the fine-tune teaches is the *shape* of real draws: strict
JSON output, valid ranges, uniqueness, ascending order, and a historically
plausible distribution.

## Pipeline

```bash
npm run data:update      # refresh data.csv + static/draws.json from data.ny.gov
npm run train:dataset    # build training/data/{train,valid}.jsonl (seeded, no AI)
npm run train:lora       # LoRA fine-tune with early stopping (~10 min on M-series)
npm run slm:serve        # serve on http://localhost:8199 (OpenAI-compatible)
node training/eval.js    # score the served model: validity rate + distribution
```

The app's `/api/slm` route talks to the served model; the UI's
"AI model (local fine-tune)" engine option uses it. If the server isn't
running the UI says so and the algorithm engine keeps working.

## Details

- **Dataset** (`build-dataset.js`): ~3,500 chat examples across 4 task types
  (multi-set, single set, single ball with exclusions, powerball-only).
  Assistant outputs are real historical draws sampled with recency weighting
  (half-life 300 draws). Prompt phrasing varies over seeded templates —
  programmatic augmentation, no AI in the loop. Reproducible via `--seed`.
- **Training** (`train-lora.sh`): `mlx_lm.lora`, rank-8 LoRA on 16 layers,
  batch 4, lr 5e-5, `--mask-prompt`, val-loss early stopping (patience 3).
  Requires a venv with `mlx-lm`; set `MLX_VENV` if yours isn't at the default
  path.
- **Serving** (`serve-slm.sh`): `mlx_lm.server` loads the base model plus the
  LoRA adapter directly — no GGUF conversion needed. (If you later want an
  Ollama model, remember the Gemma-3 gotchas from flow-forge: fuse, then
  convert with `--outtype bf16`, never fp16.)

`training/data/` and `training/adapters/` are generated and gitignored.
