// noVetoGenerator.js
import { ImprovedLotteryPredictor } from './predictorMarkTwo.js';
import { PatternVettingPredictor } from './patternPredictor.js';

function signatureOf(set) {
  return `${set.regular_balls.join(',')}|${set.powerball}`;
}

function overlapCount(a, b) {
  let i = 0, j = 0, c = 0;
  const A = [...a.regular_balls].sort((x, y) => x - y);
  const B = [...b.regular_balls].sort((x, y) => x - y);
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { c++; i++; j++; }
    else if (A[i] < B[j]) i++;
    else j++;
  }
  return c;
}

/**
 * Generate N vetted, diverse sets using historical weighting + pattern nudges.
 * @param {number} numberOfSets
 * @param {Array<Array<string|number>>} historicalData  // [date, r1, r2, r3, r4, r5, pb]
 * @param {object} opts
 */
export function generateCompliantSets(numberOfSets, historicalData, opts = {}) {
  const {
    weighting = 'exponential',          // 'linear' | 'recency' | 'exponential' | 'logarithmic' | 'uniform'
    maxOverlapRegular = 2,          // max shared regulars with any prior accepted set
    maxPerNumberUsage = 2,          // cap how often a specific regular can appear in the batch
    generationOptions = { favorHot: true, avoidCold: true, usePatterns: true },
    enforcePowerballProximity = true, // also enabled inside predictor if configured
  } = opts;

  const generator = new ImprovedLotteryPredictor();
  generator.setWeightingStrategy(weighting);

  const vet = new PatternVettingPredictor({
    enablePowerballProximity: enforcePowerballProximity,
  });

  const finalSets = [];
  const seen = new Set();
  const perNumberUsage = new Map();

  let attempts = 0;
  const MAX_ATTEMPTS = 20000;

  while (finalSets.length < numberOfSets && attempts < MAX_ATTEMPTS) {
    // Generate a single candidate
    const [candidate] = generator.predict(historicalData, 1, generationOptions);
    if (!candidate) { attempts++; continue; }

    // Run veto checks (regulars + optional powerball proximity inside)
    const vetoResult = vet.vet(candidate);
    if (vetoResult.isVetoed) { attempts++; continue; }

    // De-dup identical set
    const sig = signatureOf(candidate);
    if (seen.has(sig)) { attempts++; continue; }

    // Limit overlap with previously accepted sets
    const tooSimilar = finalSets.some(s => overlapCount(s, candidate) > maxOverlapRegular);
    if (tooSimilar) { attempts++; continue; }

    // Limit per-number usage across the whole batch
    const violatesUsage = candidate.regular_balls.some(n => (perNumberUsage.get(n) || 0) >= maxPerNumberUsage);
    if (violatesUsage) { attempts++; continue; }

    // Accept
    candidate.regular_balls.forEach(n => perNumberUsage.set(n, (perNumberUsage.get(n) || 0) + 1));
    seen.add(sig);
    finalSets.push(candidate);

    attempts++;
  }

  if (finalSets.length < numberOfSets) {
    console.warn(`Filled ${finalSets.length}/${numberOfSets} sets before hitting limits.`);
  }
  return finalSets;
}
