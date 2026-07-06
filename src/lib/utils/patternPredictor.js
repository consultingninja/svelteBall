// patternPredictor.js
export class PatternVettingPredictor {
  constructor(config = {}) {
    this.config = {
      regularBalls: { min: 1, max: 69, count: 5 },
      // --- VETO RULES CONFIGURATION ---
      maxAllowedConsecutive: 3,
      sumRange: { min: 25, max: 300 },
      maxAllowedLastDigits: 4,  // "max allowed" -> veto only when strictly GREATER
      minUniqueGaps: 2,
      maxInOneDecade: 4,
      // Powerball proximity
      enablePowerballProximity: false,
      proximityDistance: 1,
      ...config
    };
  }

  /**
   * Main vetting function. Runs all checks.
   */
  vet(sequence) {
    const regular = [...sequence.regular_balls].sort((a, b) => a - b);
    const powerball = sequence.powerball;

    const checks = [
      () => this._checkConsecutive(regular),
      () => this._checkSum(regular),
      () => this._checkArithmeticProgression(regular),
      () => this._checkLastDigits(regular),
      () => this._checkGapVariety(regular),
      () => this._checkNumberClustering(regular),
      () => this._checkCommonDivisor(regular),
      () => this.config.enablePowerballProximity
            ? this._checkPowerballProximity(regular, powerball)
            : null,
    ];

    for (const check of checks) {
      const reason = check();
      if (reason) {
        return { isVetoed: true, reason };
      }
    }
    return { isVetoed: false, reason: 'Passed all checks' };
  }

  // Veto if there are too many occurrences of the same last digit
  _checkLastDigits(sequence) {
    const lastDigits = new Map();
    for (const num of sequence) {
      const lastDigit = num % 10;
      const count = (lastDigits.get(lastDigit) || 0) + 1;
      if (count > this.config.maxAllowedLastDigits) {
        return `Vetoed: Last digit '${lastDigit}' repeated ${count} times.`;
      }
      lastDigits.set(lastDigit, count);
    }
    return null;
  }

  // Veto if there are too few unique gaps between numbers
  _checkGapVariety(sequence) {
    if (sequence.length < 4) return null;
    const gaps = new Set();
    for (let i = 0; i < sequence.length - 1; i++) {
      gaps.add(sequence[i + 1] - sequence[i]);
    }
    if (gaps.size < this.config.minUniqueGaps) {
      return `Vetoed: Found only ${gaps.size} unique gaps between numbers.`;
    }
    return null;
  }

  // Veto if there are too many numbers in the same decade
  _checkNumberClustering(sequence) {
    const decades = new Map();
    for (const num of sequence) {
      const decade = Math.floor(num / 10); // 10..19 -> 1, etc.
      const count = (decades.get(decade) || 0) + 1;
      if (count > this.config.maxInOneDecade) {
        return `Vetoed: Found ${count} numbers in the same decade (${decade}0s).`;
      }
      decades.set(decade, count);
    }
    return null;
  }

  // Veto if there are too many consecutive numbers
  _checkConsecutive(sequence) {
    let consecutiveCount = 1;
    for (let i = 0; i < sequence.length - 1; i++) {
      if (sequence[i + 1] - sequence[i] === 1) {
        consecutiveCount++;
        if (consecutiveCount > this.config.maxAllowedConsecutive) {
          return `Vetoed: Found ${consecutiveCount} consecutive numbers.`;
        }
      } else {
        consecutiveCount = 1;
      }
    }
    return null;
  }

  // Veto if the sum is outside a reasonable historical range
  _checkSum(sequence) {
    const sum = sequence.reduce((a, b) => a + b, 0);
    if (sum < this.config.sumRange.min || sum > this.config.sumRange.max) {
      return `Vetoed: Sum of numbers (${sum}) is outside the typical range.`;
    }
    return null;
  }

  // Veto if the numbers form a perfect arithmetic progression
  _checkArithmeticProgression(sequence) {
    if (sequence.length < 3) return null;
    const gaps = new Set();
    for (let i = 0; i < sequence.length - 1; i++) {
      gaps.add(sequence[i + 1] - sequence[i]);
    }
    if (gaps.size === 1) {
      return `Vetoed: Numbers form a perfect arithmetic progression.`;
    }
    return null;
  }

  _gcd(a, b) {
    return b === 0 ? a : this._gcd(b, a % b);
  }

  _findSetGcd(sequence) {
    if (sequence.length < 2) return 1;
    let result = sequence[0];
    for (let i = 1; i < sequence.length; i++) {
      result = this._gcd(result, sequence[i]);
      if (result === 1) return 1;
    }
    return result;
  }

  // Veto when all numbers share a common divisor > 2
  _checkCommonDivisor(sequence) {
    const gcd = this._findSetGcd(sequence);
    if (gcd > 2) {
      return `Vetoed: All numbers share a common divisor of ${gcd}.`;
    }
    return null;
  }

  // Veto if the powerball is too close to any regular ball
  _checkPowerballProximity(regular, powerball) {
    const d = this.config.proximityDistance;
    for (const num of regular) {
      if (Math.abs(powerball - num) <= d) {
        return `Vetoed: Powerball (${powerball}) is within ±${d} of a regular ball (${num}).`;
      }
    }
    return null;
  }
}
