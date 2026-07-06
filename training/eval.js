// Scores the served SLM (npm run slm:serve) on the tasks it was trained for:
// how often it produces valid JSON/sets, and whether its number distribution
// resembles history rather than collapsing onto a few memorized draws.
//
// Usage: node training/eval.js [--rounds 30]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLM_URL = `http://localhost:${process.env.SLM_PORT || 8199}/v1/chat/completions`;
const ROUNDS = parseInt(process.argv[process.argv.indexOf('--rounds') + 1] || '30', 10);

const SYSTEM_PROMPT =
  'You are a Powerball pick generator. Powerball tickets have 5 unique regular balls (1-69, ascending) and 1 powerball (1-26). Respond with strict JSON only, no other text.';

async function ask(user, maxTokens) {
  const res = await fetch(SLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemma-3-1b-it',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  return (await res.json()).choices[0].message.content;
}

const isValidSet = (s) =>
  Array.isArray(s?.regular_balls) &&
  s.regular_balls.length === 5 &&
  new Set(s.regular_balls).size === 5 &&
  s.regular_balls.every((b) => Number.isInteger(b) && b >= 1 && b <= 69) &&
  [...s.regular_balls].sort((a, b) => a - b).join() === s.regular_balls.join() &&
  Number.isInteger(s.powerball) && s.powerball >= 1 && s.powerball <= 26;

async function main() {
  let jsonOk = 0, setOk = 0, setTotal = 0, ballOk = 0, ballTotal = 0, exclusionViolations = 0;
  const ballCounts = new Map();
  const seenSets = new Set();
  let dupSets = 0;

  for (let round = 0; round < ROUNDS; round++) {
    // multi-set task
    try {
      const raw = await ask('Generate 5 Powerball number sets.', 420);
      const out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      jsonOk++;
      for (const s of out.sets ?? []) {
        setTotal++;
        if (isValidSet(s)) {
          setOk++;
          const sig = s.regular_balls.join(',') + '|' + s.powerball;
          if (seenSets.has(sig)) dupSets++;
          seenSets.add(sig);
          s.regular_balls.forEach((b) => ballCounts.set(b, (ballCounts.get(b) || 0) + 1));
        }
      }
    } catch { /* counts as json failure */ }

    // single-ball-with-exclusions task
    try {
      const exclude = [5, 17, 23, 41];
      const raw = await ask(`Give me one regular Powerball number (1-69) that is not any of: ${exclude.join(', ')}.`, 24);
      const out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      ballTotal++;
      if (Number.isInteger(out.ball) && out.ball >= 1 && out.ball <= 69) {
        if (exclude.includes(out.ball)) exclusionViolations++;
        else ballOk++;
      }
    } catch { ballTotal++; }
  }

  // distribution check vs. history
  const draws = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'draws.json'), 'utf8'));
  const histCounts = new Map();
  draws.forEach((d) => d.slice(1, 6).forEach((b) => histCounts.set(b, (histCounts.get(b) || 0) + 1)));
  const modelTotal = [...ballCounts.values()].reduce((a, b) => a + b, 0);
  const distinctNumbers = ballCounts.size;

  console.log(`rounds: ${ROUNDS}`);
  console.log(`json parse rate (5-set task): ${jsonOk}/${ROUNDS}`);
  console.log(`valid sets: ${setOk}/${setTotal}`);
  console.log(`duplicate sets across all rounds: ${dupSets}`);
  console.log(`single-ball valid: ${ballOk}/${ballTotal} (exclusion violations: ${exclusionViolations})`);
  console.log(`distinct regular numbers used: ${distinctNumbers}/69 over ${modelTotal} balls`);
  if (distinctNumbers < 40) {
    console.log('WARNING: low number diversity — the model may have collapsed onto memorized draws.');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
