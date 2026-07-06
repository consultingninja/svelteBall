// Veto rules: reject candidate sets with patterns people consider
// "unlottery-like". Ported from patternPredictor.js with fixed defaults —
// the old maxAllowedLastDigits of 4 could only veto a 5-of-a-kind, which is
// nearly impossible, so the rule never fired.

/**
 * @param {{regular_balls: number[], powerball: number}} set
 * @param {object} veto  resolved config.veto
 * @returns {{isVetoed: boolean, reason: string|null}}
 */
export function vet(set, veto) {
  if (!veto.enabled) return { isVetoed: false, reason: null };

  const regs = [...set.regular_balls].sort((a, b) => a - b);

  const reason =
    checkConsecutive(regs, veto.maxConsecutive) ||
    checkSum(regs, veto.sumRange) ||
    checkLastDigits(regs, veto.maxSameLastDigit) ||
    checkGapVariety(regs, veto.minUniqueGaps) ||
    checkDecadeClustering(regs, veto.maxInOneDecade) ||
    (veto.vetoArithmeticProgression ? checkArithmeticProgression(regs) : null) ||
    (veto.vetoCommonDivisor ? checkCommonDivisor(regs) : null) ||
    (veto.powerballProximity.enabled
      ? checkPowerballProximity(regs, set.powerball, veto.powerballProximity.distance)
      : null);

  return { isVetoed: !!reason, reason: reason || null };
}

function checkConsecutive(regs, maxConsecutive) {
  let run = 1;
  for (let i = 1; i < regs.length; i++) {
    run = regs[i] - regs[i - 1] === 1 ? run + 1 : 1;
    if (run > maxConsecutive) return `${run} consecutive numbers`;
  }
  return null;
}

function checkSum(regs, sumRange) {
  const sum = regs.reduce((a, b) => a + b, 0);
  if (sum < sumRange.min || sum > sumRange.max) {
    return `sum ${sum} outside ${sumRange.min}-${sumRange.max}`;
  }
  return null;
}

function checkLastDigits(regs, maxSameLastDigit) {
  const counts = new Map();
  for (const n of regs) {
    const d = n % 10;
    const c = (counts.get(d) || 0) + 1;
    if (c > maxSameLastDigit) return `${c} numbers ending in ${d}`;
    counts.set(d, c);
  }
  return null;
}

function checkGapVariety(regs, minUniqueGaps) {
  const gaps = new Set();
  for (let i = 1; i < regs.length; i++) gaps.add(regs[i] - regs[i - 1]);
  if (gaps.size < minUniqueGaps) return `only ${gaps.size} unique gap(s)`;
  return null;
}

function checkDecadeClustering(regs, maxInOneDecade) {
  const decades = new Map();
  for (const n of regs) {
    const d = Math.floor(n / 10);
    const c = (decades.get(d) || 0) + 1;
    if (c > maxInOneDecade) return `${c} numbers in the ${d}0s`;
    decades.set(d, c);
  }
  return null;
}

function checkArithmeticProgression(regs) {
  const gaps = new Set();
  for (let i = 1; i < regs.length; i++) gaps.add(regs[i] - regs[i - 1]);
  return gaps.size === 1 ? 'perfect arithmetic progression' : null;
}

function checkCommonDivisor(regs) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  let g = regs[0];
  for (let i = 1; i < regs.length && g > 1; i++) g = gcd(g, regs[i]);
  return g > 2 ? `all numbers divisible by ${g}` : null;
}

function checkPowerballProximity(regs, powerball, distance) {
  for (const n of regs) {
    if (Math.abs(powerball - n) <= distance) {
      return `powerball ${powerball} within ${distance} of ${n}`;
    }
  }
  return null;
}
