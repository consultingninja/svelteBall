// One-time analysis of historical draws. The result feeds the generator so
// generation never re-scans history (the old predictor re-analyzed all draws
// on every candidate attempt, thousands of times per batch).

import { POOLS } from './config.js';

/**
 * @param {Array<[string, number, number, number, number, number, number]>} draws
 *   Modern-era draws as [isoDate, r1..r5, powerball], oldest first
 *   (the format of static/draws.json).
 */
export function analyze(draws, config) {
  const valid = draws.filter(isValidDraw);
  const n = valid.length;

  const weightFn = weightFunctions[config.weighting] || weightFunctions.exponential;
  const regularWeights = new Map();
  const powerballWeights = new Map();
  const regularCounts = new Map();
  const pairCounts = new Map();

  valid.forEach((draw, i) => {
    const w = weightFn(i, n, config);
    const regs = draw.slice(1, 6);
    for (const ball of regs) {
      regularWeights.set(ball, (regularWeights.get(ball) || 0) + w);
      regularCounts.set(ball, (regularCounts.get(ball) || 0) + 1);
    }
    powerballWeights.set(draw[6], (powerballWeights.get(draw[6]) || 0) + w);
    for (let a = 0; a < regs.length; a++) {
      for (let b = a + 1; b < regs.length; b++) {
        const key = regs[a] < regs[b] ? `${regs[a]}-${regs[b]}` : `${regs[b]}-${regs[a]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  });

  const byCount = [...regularCounts.entries()].sort((a, b) => b[1] - a[1]);
  const hot = new Set(byCount.slice(0, 10).map(([ball]) => ball));
  const cold = new Set(byCount.slice(-10).map(([ball]) => ball));

  return {
    drawCount: n,
    regularDistribution: toDistribution(regularWeights, POOLS.regular.min, POOLS.regular.max),
    powerballDistribution: toDistribution(powerballWeights, POOLS.powerball.min, POOLS.powerball.max),
    hot,
    cold,
    pairCounts,
    stats: {
      hotNumbers: [...hot],
      coldNumbers: [...cold],
      topPairs: [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
  };
}

function isValidDraw(draw) {
  if (!Array.isArray(draw) || draw.length !== 7) return false;
  const regs = draw.slice(1, 6);
  if (new Set(regs).size !== 5) return false;
  if (regs.some((r) => !Number.isInteger(r) || r < POOLS.regular.min || r > POOLS.regular.max)) return false;
  const pb = draw[6];
  return Number.isInteger(pb) && pb >= POOLS.powerball.min && pb <= POOLS.powerball.max;
}

// All strategies are bounded: newest draw gets weight 1, older draws get
// (0, 1]. The old exponential (1.1^index) overflowed past ~1e73 with a full
// history, so effectively only the last handful of draws counted.
const weightFunctions = {
  uniform: () => 1,
  linear: (i, n) => (i + 1) / n,
  exponential: (i, n, config) => {
    const halfLife = Math.max(1, config.halfLifeDraws || 300);
    return Math.pow(0.5, (n - 1 - i) / halfLife);
  },
  recency: (i, n) => Math.pow((i + 1) / n, 2),
  logarithmic: (i, n) => Math.log(i + 2) / Math.log(n + 1),
};

function toDistribution(weights, min, max) {
  const dist = [];
  for (let value = min; value <= max; value++) {
    // Numbers never seen still get a small floor weight so they stay possible.
    dist.push({ value, weight: weights.get(value) || 0.05 });
  }
  return dist;
}
