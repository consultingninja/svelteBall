// Builds an MLX chat-format SFT dataset (train.jsonl / valid.jsonl) from the
// confirmed modern-era draws in static/draws.json.
//
// Assistant outputs are real historical draws, so the model learns the true
// draw distribution and strict output formats. Prompt phrasing is varied with
// seeded templates (programmatic augmentation, no AI in the loop — same idea
// as adv-rag/training-data-gen/scripts/augment_data.mjs).
//
// Task types:
//   sets       -> {"sets":[{"regular_balls":[..5 sorted..],"powerball":n}, ...]}
//   set        -> {"sets":[{...one...}]}
//   ball       -> {"ball":n}        (respects an exclusion list)
//   powerball  -> {"powerball":n}
//
// Usage: node training/build-dataset.js [--seed 42] [--out training/data]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
const SEED = parseInt(arg('seed', '42'), 10);
const OUT_DIR = path.resolve(ROOT, arg('out', 'training/data'));

const COUNTS = { sets: 1600, set: 600, ball: 900, powerball: 400 };
const VALID_FRACTION = 0.1;
const HALF_LIFE = 300; // draws; matches the engine's default recency weighting

export const SYSTEM_PROMPT =
  'You are a Powerball pick generator. Powerball tickets have 5 unique regular balls (1-69, ascending) and 1 powerball (1-26). Respond with strict JSON only, no other text.';

// --- seeded RNG (mulberry32) so the dataset is reproducible ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const draws = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'draws.json'), 'utf8'));

// Recency-weighted draw sampling: recent draws appear more often as targets,
// mirroring how the algorithmic engine weights history.
const drawWeights = draws.map((_, i) => Math.pow(0.5, (draws.length - 1 - i) / HALF_LIFE));
const totalWeight = drawWeights.reduce((a, b) => a + b, 0);
function sampleDraw() {
  let r = rand() * totalWeight;
  for (let i = 0; i < draws.length; i++) {
    r -= drawWeights[i];
    if (r < 0) return draws[i];
  }
  return draws[draws.length - 1];
}
function sampleDistinctDraws(n) {
  const chosen = [];
  const seen = new Set();
  while (chosen.length < n) {
    const d = sampleDraw();
    if (seen.has(d[0])) continue;
    seen.add(d[0]);
    chosen.push(d);
  }
  return chosen;
}

const drawToSet = (d) => ({ regular_balls: d.slice(1, 6), powerball: d[6] });

// --- prompt templates ---
const SETS_TEMPLATES = [
  (n) => `Generate ${n} Powerball number sets.`,
  (n) => `Give me ${n} sets of Powerball numbers.`,
  (n) => `I need ${n} Powerball tickets. Pick the numbers.`,
  (n) => `Pick ${n} full Powerball lines for me.`,
  (n) => `${n} powerball sets please`,
  (n) => `Create ${n} plays for tonight's Powerball drawing.`,
];
const SET_TEMPLATES = [
  () => 'Generate one Powerball number set.',
  () => 'Give me a single set of Powerball numbers.',
  () => 'Pick one Powerball ticket for me.',
  () => 'one powerball line please',
  () => 'I need a quick pick: one full Powerball set.',
];
const BALL_TEMPLATES = [
  (ex) => `Give me one regular Powerball number (1-69)${ex.length ? ` that is not any of: ${ex.join(', ')}` : ''}.`,
  (ex) => `Pick a single regular ball${ex.length ? `, excluding ${ex.join(', ')}` : ''}.`,
  (ex) => `one more regular number${ex.length ? `, I already have ${ex.join(', ')}` : ''}`,
  (ex) => `Add one regular ball to my ticket${ex.length ? ` (current: ${ex.join(', ')})` : ''}.`,
];
const POWERBALL_TEMPLATES = [
  () => 'Give me just a powerball number (1-26).',
  () => 'Pick the powerball only.',
  () => 'powerball please',
  () => 'I have my 5 regular numbers; pick my powerball.',
];

function example(user, assistantObj) {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: user },
      { role: 'assistant', content: JSON.stringify(assistantObj) },
    ],
  };
}

function buildExamples() {
  const examples = [];

  for (let i = 0; i < COUNTS.sets; i++) {
    // mostly 5 sets (the common request), sometimes 1-10
    const n = rand() < 0.5 ? 5 : randInt(1, 10);
    examples.push(example(pick(SETS_TEMPLATES)(n), { sets: sampleDistinctDraws(n).map(drawToSet) }));
  }

  for (let i = 0; i < COUNTS.set; i++) {
    examples.push(example(pick(SET_TEMPLATES)(), { sets: [drawToSet(sampleDraw())] }));
  }

  for (let i = 0; i < COUNTS.ball; i++) {
    const excludeCount = randInt(0, 4);
    const source = drawToSet(sampleDraw());
    // exclusions drawn from the same draw guarantee the answer isn't excluded
    const exclude = source.regular_balls.slice(0, excludeCount);
    const answer = pick(source.regular_balls.slice(excludeCount));
    examples.push(example(pick(BALL_TEMPLATES)(exclude), { ball: answer }));
  }

  for (let i = 0; i < COUNTS.powerball; i++) {
    examples.push(example(pick(POWERBALL_TEMPLATES)(), { powerball: sampleDraw()[6] }));
  }

  // seeded Fisher-Yates shuffle before splitting
  for (let i = examples.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [examples[i], examples[j]] = [examples[j], examples[i]];
  }
  return examples;
}

function validateExample(ex) {
  const out = JSON.parse(ex.messages[2].content);
  if (out.sets) {
    for (const s of out.sets) {
      if (s.regular_balls.length !== 5) return 'wrong ball count';
      if (new Set(s.regular_balls).size !== 5) return 'duplicate balls';
      if ([...s.regular_balls].sort((a, b) => a - b).join() !== s.regular_balls.join()) return 'not sorted';
      if (s.regular_balls.some((b) => b < 1 || b > 69)) return 'ball out of range';
      if (s.powerball < 1 || s.powerball > 26) return 'powerball out of range';
    }
  } else if (out.ball !== undefined) {
    if (out.ball < 1 || out.ball > 69) return 'ball out of range';
    const m = ex.messages[1].content.match(/(?:not any of|excluding|already have|current): ([\d, ]+)/);
    if (m && m[1].split(',').map(Number).includes(out.ball)) return 'excluded ball returned';
  } else if (out.powerball !== undefined) {
    if (out.powerball < 1 || out.powerball > 26) return 'powerball out of range';
  } else {
    return 'unknown output shape';
  }
  return null;
}

function main() {
  const examples = buildExamples();
  const problems = examples.map(validateExample).filter(Boolean);
  if (problems.length) {
    console.error(`${problems.length} invalid examples, e.g. ${problems[0]}`);
    process.exit(1);
  }

  const splitAt = Math.floor(examples.length * (1 - VALID_FRACTION));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, rows) =>
    fs.writeFileSync(path.join(OUT_DIR, name), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  write('train.jsonl', examples.slice(0, splitAt));
  write('valid.jsonl', examples.slice(splitAt));

  fs.writeFileSync(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify({ seed: SEED, counts: COUNTS, sourceDraws: draws.length, train: splitAt, valid: examples.length - splitAt }, null, 2)
  );
  console.log(`Wrote ${splitAt} train / ${examples.length - splitAt} valid examples to ${OUT_DIR} (seed ${SEED}).`);
}

main();
