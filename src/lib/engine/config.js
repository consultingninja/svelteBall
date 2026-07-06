// Central configuration for the generation engine. Every option here is
// surfaced in the UI config panel; keep defaults conservative.

export const POOLS = {
  regular: { min: 1, max: 69, count: 5 },
  powerball: { min: 1, max: 26 },
};

export const WEIGHTING_STRATEGIES = ['uniform', 'linear', 'exponential', 'recency', 'logarithmic'];

export const defaultConfig = {
  // How much recent draws outweigh old ones when building frequencies.
  weighting: 'exponential',
  // For 'exponential': a draw this many draws ago counts half as much.
  halfLifeDraws: 300,

  // Sampling nudges (all off by default: the base weighted sampling already
  // reflects history).
  favorHot: false,
  hotBoost: 1.5,
  avoidCold: false,
  coldPenalty: 0.3,
  usePatterns: false,
  patternBoost: 1.2,

  // Veto rules: reject candidate sets that look "unlottery-like".
  veto: {
    enabled: true,
    maxConsecutive: 3,       // veto runs longer than this
    sumRange: { min: 60, max: 290 },
    maxSameLastDigit: 3,     // veto when 4+ balls share a last digit
    minUniqueGaps: 2,
    maxInOneDecade: 4,
    vetoArithmeticProgression: true,
    vetoCommonDivisor: true, // veto when all balls share a divisor > 2
    powerballProximity: { enabled: false, distance: 1 },
  },

  // Diversity constraints across a generated batch of sets.
  batch: {
    maxOverlap: 2,          // max regular balls shared between any two sets
    maxPerNumberUsage: 2,   // max times one regular ball appears in a batch
  },
};

/** Deep-merge a partial user config over the defaults. */
export function resolveConfig(partial = {}) {
  return {
    ...defaultConfig,
    ...partial,
    veto: {
      ...defaultConfig.veto,
      ...(partial.veto || {}),
      sumRange: { ...defaultConfig.veto.sumRange, ...(partial.veto?.sumRange || {}) },
      powerballProximity: {
        ...defaultConfig.veto.powerballProximity,
        ...(partial.veto?.powerballProximity || {}),
      },
    },
    batch: { ...defaultConfig.batch, ...(partial.batch || {}) },
  };
}
