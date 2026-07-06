# svelteBall — Powerball pick generator

A SvelteKit app (with a Capacitor Android wrapper) that generates Powerball
picks two ways:

- **Algorithm engine** (`src/lib/engine/`) — runs entirely on-device.
  Weighted-frequency sampling over the confirmed draw history with
  configurable recency weighting, hot/cold/pair nudges, veto rules for
  "unlottery-like" patterns, and batch diversity constraints.
- **AI model engine** (`training/`, `/api/slm`) — a locally fine-tuned
  `gemma-3-1b-it` LoRA that emits picks as strict JSON, served by
  `mlx_lm.server`. Dev/desktop feature; see `training/README.md`.

Honesty note: Powerball draws are independent random events. Nothing here
predicts anything — picks are shaped to *look like* historical draws, for fun.

## Commands

```bash
npm run dev            # app at localhost:5173
npm test               # engine test suite (node --test)
npm run data:update    # refresh draw history from data.ny.gov (official)
npm run data:check     # validate data.csv without touching it
npm run train:dataset  # build SFT dataset from confirmed draws
npm run train:lora     # fine-tune locally with MLX LoRA (Apple Silicon)
npm run slm:serve      # serve the fine-tuned model for /api/slm
```

## Data

`data.csv` holds the full draw archive (1992→present). Everything from
Feb 2010 onward is confirmed against the official NY Open Data Powerball
dataset (`d6yy-54nr`); earlier rows are preserved as unverified legacy and
excluded from modeling. `static/draws.json` carries only the modern-era
draws (Oct 2015+, current 69/26 rules) and is what both engines learn from.
The old puppeteer scraper was removed — it had been silently mixing in
Double Play drawings and dropping regular balls.

## Generation granularity

The UI generates multiple sets, a single set, or builds a ticket one ball at
a time (each new ball excludes the ones you already have). All engine
options — weighting strategy, half-life, hot/cold/pair nudges, veto rules,
batch diversity — are editable under "Options" and persist locally.
