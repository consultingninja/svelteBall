// Generation engine. Create one engine per config, then generate as many
// sets/balls as needed — analysis runs exactly once.
//
// Works in both the browser and Node 20+: randomness comes from
// globalThis.crypto.getRandomValues (no node:crypto import, so the engine can
// run client-side in the prerendered/Capacitor build).

import { POOLS, resolveConfig } from './config.js';
import { analyze } from './analyzer.js';
import { vet } from './vetting.js';

const MAX_ATTEMPTS_PER_SET = 4000;

export function createEngine(draws, userConfig = {}) {
  const config = resolveConfig(userConfig);
  const analysis = analyze(draws, config);

  /** One uniformly random float in [0, 1) from the platform CSPRNG. */
  function randomFloat() {
    const u32 = new Uint32Array(1);
    globalThis.crypto.getRandomValues(u32);
    return u32[0] / 2 ** 32;
  }

  function weightedPick(distribution, excluded) {
    let total = 0;
    for (const item of distribution) {
      if (!excluded || !excluded.has(item.value)) total += item.weight;
    }
    if (total <= 0) throw new Error('No pickable numbers left in distribution');
    let r = randomFloat() * total;
    for (const item of distribution) {
      if (excluded && excluded.has(item.value)) continue;
      r -= item.weight;
      if (r < 0) return item.value;
    }
    // Floating-point edge: return the last non-excluded value.
    for (let i = distribution.length - 1; i >= 0; i--) {
      if (!excluded || !excluded.has(distribution[i].value)) return distribution[i].value;
    }
    throw new Error('No pickable numbers left in distribution');
  }

  function nudgedRegularDistribution(chosen) {
    let dist = analysis.regularDistribution;
    const { favorHot, hotBoost, avoidCold, coldPenalty, usePatterns, patternBoost } = config;
    if (!favorHot && !avoidCold && !(usePatterns && chosen.size)) return dist;

    const boosted = new Set();
    if (usePatterns && chosen.size) {
      for (const key of analysis.pairCounts.keys()) {
        const [a, b] = key.split('-').map(Number);
        if (chosen.has(a)) boosted.add(b);
        if (chosen.has(b)) boosted.add(a);
      }
    }
    return dist.map((item) => {
      let weight = item.weight;
      if (favorHot && analysis.hot.has(item.value)) weight *= hotBoost;
      if (avoidCold && analysis.cold.has(item.value)) weight *= coldPenalty;
      if (boosted.has(item.value)) weight *= patternBoost;
      return { value: item.value, weight };
    });
  }

  /** One regular ball, optionally excluding already-picked numbers. */
  function generateBall(exclude = []) {
    return weightedPick(nudgedRegularDistribution(new Set(exclude)), new Set(exclude));
  }

  function generatePowerball() {
    return weightedPick(analysis.powerballDistribution);
  }

  /** One full set that passes the veto rules. */
  function generateSet() {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SET; attempt++) {
      const chosen = new Set();
      while (chosen.size < POOLS.regular.count) {
        chosen.add(weightedPick(nudgedRegularDistribution(chosen), chosen));
      }
      const candidate = {
        regular_balls: [...chosen].sort((a, b) => a - b),
        powerball: generatePowerball(),
      };
      if (!vet(candidate, config.veto).isVetoed) return candidate;
    }
    throw new Error('Could not generate a set passing the veto rules; loosen the rules.');
  }

  /** A batch of sets that are mutually diverse per config.batch. */
  function generateSets(count) {
    const sets = [];
    const seen = new Set();
    const usage = new Map();
    const { maxOverlap, maxPerNumberUsage } = config.batch;

    let attempts = 0;
    const maxAttempts = Math.max(2000, count * 400);
    while (sets.length < count && attempts++ < maxAttempts) {
      const candidate = generateSet();

      const sig = `${candidate.regular_balls.join(',')}|${candidate.powerball}`;
      if (seen.has(sig)) continue;
      if (sets.some((s) => overlap(s.regular_balls, candidate.regular_balls) > maxOverlap)) continue;
      if (candidate.regular_balls.some((n) => (usage.get(n) || 0) >= maxPerNumberUsage)) continue;

      seen.add(sig);
      candidate.regular_balls.forEach((n) => usage.set(n, (usage.get(n) || 0) + 1));
      sets.push(candidate);
    }
    return sets;
  }

  return {
    config,
    statistics: analysis.stats,
    drawCount: analysis.drawCount,
    generateBall,
    generatePowerball,
    generateSet,
    generateSets,
  };
}

function overlap(a, b) {
  const setB = new Set(b);
  let c = 0;
  for (const n of a) if (setB.has(n)) c++;
  return c;
}
