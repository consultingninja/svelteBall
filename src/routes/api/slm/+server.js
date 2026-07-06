// Generates picks with the locally fine-tuned SLM (gemma-3-1b-it + LoRA)
// served by `npm run slm:serve` (mlx_lm.server, OpenAI-compatible API).
// Model output is validated and re-rolled; invalid responses never reach the
// client. This route needs a server, so it's a dev/desktop feature — the
// static Capacitor build uses the on-device algorithm engine instead.

import { json } from '@sveltejs/kit';
import { vet } from '$lib/engine/vetting.js';
import { resolveConfig, POOLS } from '$lib/engine/config.js';

export const prerender = false;

const SLM_URL = `http://localhost:${process.env.SLM_PORT || 8199}/v1/chat/completions`;
const MAX_ATTEMPTS = 5;

const SYSTEM_PROMPT =
  'You are a Powerball pick generator. Powerball tickets have 5 unique regular balls (1-69, ascending) and 1 powerball (1-26). Respond with strict JSON only, no other text.';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === 'set' || body.mode === 'ticket' ? body.mode : 'sets';
  const count = Math.min(Math.max(parseInt(body.count, 10) || 1, 1), 20);
  const exclude = Array.isArray(body.exclude) ? body.exclude.map(Number).filter(Number.isInteger) : [];
  const veto = resolveConfig({ veto: body.veto || {} }).veto;

  try {
    if (mode === 'ticket') {
      if (body.wantPowerball) {
        return json({ powerball: await generatePowerball() });
      }
      return json({ ball: await generateBall(exclude) });
    }
    const wanted = mode === 'set' ? 1 : count;
    return json({ sets: await generateSets(wanted, veto) });
  } catch (err) {
    const unreachable = err?.cause?.code === 'ECONNREFUSED';
    return json(
      {
        error: unreachable
          ? 'Local AI model is not running. Start it with "npm run slm:serve".'
          : `AI generation failed: ${err.message}`,
      },
      { status: 503 }
    );
  }
}

async function askModel(userMessage, maxTokens) {
  const res = await fetch(SLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // must match the --model mlx_lm.server was started with; unknown names
      // trigger a HuggingFace lookup and 404
      model: 'google/gemma-3-1b-it',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`model server returned ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  // tolerate stray text around the JSON object
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON in model output');
  return JSON.parse(content.slice(start, end + 1));
}

function isValidSet(s) {
  if (!s || !Array.isArray(s.regular_balls) || s.regular_balls.length !== POOLS.regular.count) return false;
  if (new Set(s.regular_balls).size !== POOLS.regular.count) return false;
  if (s.regular_balls.some((b) => !Number.isInteger(b) || b < POOLS.regular.min || b > POOLS.regular.max)) return false;
  return Number.isInteger(s.powerball) && s.powerball >= POOLS.powerball.min && s.powerball <= POOLS.powerball.max;
}

async function generateSets(wanted, veto) {
  const sets = [];
  const seen = new Set();
  for (let attempt = 0; attempt < MAX_ATTEMPTS && sets.length < wanted; attempt++) {
    const remaining = wanted - sets.length;
    const prompt =
      remaining === 1 ? 'Generate one Powerball number set.' : `Generate ${remaining} Powerball number sets.`;
    let out;
    try {
      out = await askModel(prompt, 120 + remaining * 60);
    } catch (e) {
      if (e?.cause?.code === 'ECONNREFUSED') throw e;
      continue; // malformed output: re-roll
    }
    for (const raw of Array.isArray(out.sets) ? out.sets : []) {
      if (sets.length >= wanted) break;
      if (!isValidSet(raw)) continue;
      const set = { regular_balls: [...raw.regular_balls].sort((a, b) => a - b), powerball: raw.powerball };
      const sig = `${set.regular_balls.join(',')}|${set.powerball}`;
      if (seen.has(sig)) continue;
      if (vet(set, veto).isVetoed) continue;
      seen.add(sig);
      sets.push(set);
    }
  }
  if (sets.length === 0) throw new Error('model produced no valid sets');
  return sets;
}

async function generateBall(exclude) {
  const excluded = new Set(exclude);
  const prompt = exclude.length
    ? `Give me one regular Powerball number (1-69) that is not any of: ${exclude.join(', ')}.`
    : 'Give me one regular Powerball number (1-69).';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let out;
    try {
      out = await askModel(prompt, 24);
    } catch (e) {
      if (e?.cause?.code === 'ECONNREFUSED') throw e;
      continue;
    }
    const ball = out.ball;
    if (Number.isInteger(ball) && ball >= POOLS.regular.min && ball <= POOLS.regular.max && !excluded.has(ball)) {
      return ball;
    }
  }
  throw new Error('model produced no valid ball');
}

async function generatePowerball() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let out;
    try {
      out = await askModel('Pick the powerball only.', 24);
    } catch (e) {
      if (e?.cause?.code === 'ECONNREFUSED') throw e;
      continue;
    }
    const pb = out.powerball;
    if (Number.isInteger(pb) && pb >= POOLS.powerball.min && pb <= POOLS.powerball.max) return pb;
  }
  throw new Error('model produced no valid powerball');
}
