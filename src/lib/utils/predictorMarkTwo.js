// predictorMarkTwo.js
import nodeCrypto from 'crypto';

export class ImprovedLotteryPredictor {
  constructor(config = {}) {
    this.config = {
      regularBalls: { min: 1, max: 69, count: 5 },
      powerball: { min: 1, max: 26, count: 1 },
      ...config
    };

    this.validHistoricalDraws = [];
    this.weightedFrequencies = {
      regular: new Map(),
      powerball: new Map()
    };
    this.probabilityDistributions = {
      regular: [],
      powerball: []
    };

    // Analytics
    this.statistics = {
      hotNumbers: { regular: [], powerball: [] },
      coldNumbers: { regular: [], powerball: [] },
      pairFrequencies: new Map(),
      tripletFrequencies: new Map(),
      gapAnalysis: new Map(),
      lastSeenMap: new Map()
    };

    this.weightingStrategies = {
      linear: (index, total) => index + 1,
      exponential: (index, total) => Math.pow(1.1, index),
      logarithmic: (index, total) => Math.log(index + 2),
      recency: (index, total) => Math.pow((index + 1) / total, 2) * 100,
      uniform: () => 1
    };

    this.activeStrategy = 'linear';
  }

  _secureRandomFloat() {
    if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
      const buf = nodeCrypto.randomBytes(4);
      return buf.readUInt32BE(0) / (0xFFFFFFFF + 1);
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const u32 = new Uint32Array(1);
      globalThis.crypto.getRandomValues(u32);
      return u32[0] / (0xFFFFFFFF + 1);
    }
    // Fallback
    return Math.random();
  }

  setWeightingStrategy(strategyName) {
    if (this.weightingStrategies[strategyName]) {
      this.activeStrategy = strategyName;
    } else {
      throw new Error(`Unknown weighting strategy: ${strategyName}`);
    }
  }

  _isValidDraw(drawNumbers) {
    if (drawNumbers.length !== this.config.regularBalls.count + this.config.powerball.count) return false;

    const regularBalls = drawNumbers.slice(0, this.config.regularBalls.count);
    const powerball = drawNumbers[this.config.regularBalls.count];

    const regularSet = new Set();
    for (const ball of regularBalls) {
      if (ball < this.config.regularBalls.min || ball > this.config.regularBalls.max) return false;
      regularSet.add(ball);
    }
    if (regularSet.size !== this.config.regularBalls.count) return false;

    if (powerball < this.config.powerball.min || powerball > this.config.powerball.max) return false;

    return true;
  }

  _preprocessData(rawData) {
    this.validHistoricalDraws = [];
    for (const rawDraw of rawData) {
      const dateString = rawDraw[0];
      const numbersAsStrings = rawDraw.slice(1);

      if (numbersAsStrings.length !== this.config.regularBalls.count + this.config.powerball.count) continue;

      const numbers = numbersAsStrings.map(Number);
      if (numbers.some(isNaN)) continue;

      if (this._isValidDraw(numbers)) {
        const drawDate = new Date(dateString);
        if (isNaN(drawDate.getTime())) continue;

        this.validHistoricalDraws.push({
          date: drawDate,
          regular: numbers.slice(0, this.config.regularBalls.count),
          powerball: numbers[this.config.regularBalls.count]
        });
      }
    }
    this.validHistoricalDraws.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  _calculateStatistics() {
    const regularFreq = new Map();
    const powerballFreq = new Map();
    this.statistics.pairFrequencies.clear();
    this.statistics.tripletFrequencies.clear();
    this.statistics.gapAnalysis.clear();
    this.statistics.lastSeenMap.clear();

    for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
      regularFreq.set(i, 0);
      this.statistics.gapAnalysis.set(i, []);
    }
    for (let i = this.config.powerball.min; i <= this.config.powerball.max; i++) {
      powerballFreq.set(i, 0);
    }

    this.validHistoricalDraws.forEach((draw, drawIndex) => {
      // Regular ball frequencies and gaps
      draw.regular.forEach(ball => {
        regularFreq.set(ball, regularFreq.get(ball) + 1);
        const gaps = this.statistics.gapAnalysis.get(ball);
        const lastSeen = this.statistics.lastSeenMap.get(ball);
        if (lastSeen !== undefined) gaps.push(drawIndex - lastSeen);
        this.statistics.lastSeenMap.set(ball, drawIndex);
      });

      // Powerball frequencies
      powerballFreq.set(draw.powerball, powerballFreq.get(draw.powerball) + 1);

      // Pair frequencies
      for (let i = 0; i < draw.regular.length; i++) {
        for (let j = i + 1; j < draw.regular.length; j++) {
          const pair = `${draw.regular[i]}-${draw.regular[j]}`;
          this.statistics.pairFrequencies.set(pair, (this.statistics.pairFrequencies.get(pair) || 0) + 1);
        }
      }

      // Triplet frequencies
      for (let i = 0; i < draw.regular.length; i++) {
        for (let j = i + 1; j < draw.regular.length; j++) {
          for (let k = j + 1; k < draw.regular.length; k++) {
            const triplet = `${draw.regular[i]}-${draw.regular[j]}-${draw.regular[k]}`;
            this.statistics.tripletFrequencies.set(triplet, (this.statistics.tripletFrequencies.get(triplet) || 0) + 1);
          }
        }
      }
    });

    const regularArray = Array.from(regularFreq.entries()).sort((a, b) => b[1] - a[1]);
    const powerballArray = Array.from(powerballFreq.entries()).sort((a, b) => b[1] - a[1]);

    this.statistics.hotNumbers.regular = regularArray.slice(0, 10).map(([num]) => num);
    this.statistics.coldNumbers.regular = regularArray.slice(-10).map(([num]) => num);
    this.statistics.hotNumbers.powerball = powerballArray.slice(0, 5).map(([num]) => num);
    this.statistics.coldNumbers.powerball = powerballArray.slice(-5).map(([num]) => num);
  }

  _calculateWeightedFrequencies() {
    this.weightedFrequencies.regular.clear();
    this.weightedFrequencies.powerball.clear();

    if (this.validHistoricalDraws.length === 0) return;

    const weightingFunction = this.weightingStrategies[this.activeStrategy];
    const total = this.validHistoricalDraws.length;

    this.validHistoricalDraws.forEach((draw, index) => {
      const weight = weightingFunction(index, total);
      for (const ball of draw.regular) {
        this.weightedFrequencies.regular.set(ball, (this.weightedFrequencies.regular.get(ball) || 0) + weight);
      }
      this.weightedFrequencies.powerball.set(draw.powerball, (this.weightedFrequencies.powerball.get(draw.powerball) || 0) + weight);
    });
  }

  _createProbabilityDistributions() {
    this.probabilityDistributions.regular = [];
    this.probabilityDistributions.powerball = [];

    for (const [number, weight] of this.weightedFrequencies.regular) {
      this.probabilityDistributions.regular.push({ value: number, weight });
    }
    this.probabilityDistributions.regular.sort((a, b) => a.value - b.value);

    for (const [number, weight] of this.weightedFrequencies.powerball) {
      this.probabilityDistributions.powerball.push({ value: number, weight });
    }
    this.probabilityDistributions.powerball.sort((a, b) => a.value - b.value);

    // fill missing numbers lightly
    const addMissing = (arr, min, max) => {
      const existing = new Set(arr.map(d => d.value));
      for (let i = min; i <= max; i++) {
        if (!existing.has(i)) arr.push({ value: i, weight: 0.1 });
      }
      arr.sort((x, y) => x.value - y.value);
    };

    addMissing(this.probabilityDistributions.regular, this.config.regularBalls.min, this.config.regularBalls.max);
    addMissing(this.probabilityDistributions.powerball, this.config.powerball.min, this.config.powerball.max);
  }

  _weightedRandomPick(distribution) {
    if (!distribution || distribution.length === 0) {
      throw new Error("Cannot pick from an empty or invalid distribution.");
    }

    let totalWeight = 0;
    for (const item of distribution) totalWeight += item.weight;

    if (totalWeight === 0) {
      const randomIndex = Math.floor(this._secureRandomFloat() * distribution.length);
      return distribution[randomIndex].value;
    }

    const r = this._secureRandomFloat() * totalWeight;
    let acc = 0;
    for (const item of distribution) {
      acc += item.weight;
      if (r < acc) return item.value;
    }
    return distribution[distribution.length - 1].value;
  }

  _generateSingleSet(options = {}) {
    const {
      avoidCold = false,
      favorHot = false,
      usePatterns = false,
      balanceOddEven = false,
      balanceHighLow = false
    } = options;

    const regularBalls = new Set();
    let attempts = 0;
    const MAX_ATTEMPTS_PER_BALL_SET = 1000;

    // base distribution
    const baseDist = [...this.probabilityDistributions.regular];

    // utility to produce a per-iteration modified distribution
    const buildDistribution = (chosen) => {
      let dist = baseDist.map(item => ({ ...item }));

      if (avoidCold && this.statistics.coldNumbers.regular.length > 0) {
        dist = dist.map(item => ({
          ...item,
          weight: this.statistics.coldNumbers.regular.includes(item.value)
            ? item.weight * 0.3 : item.weight
        }));
      }
      if (favorHot && this.statistics.hotNumbers.regular.length > 0) {
        dist = dist.map(item => ({
          ...item,
          weight: this.statistics.hotNumbers.regular.includes(item.value)
            ? item.weight * 1.5 : item.weight
        }));
      }

      if (usePatterns && chosen.length > 0 && this.statistics.pairFrequencies.size > 0) {
        const boost = new Set();
        for (const [pair, freq] of this.statistics.pairFrequencies) {
          const [a, b] = pair.split('-').map(Number);
          if (chosen.includes(a)) boost.add(b);
          if (chosen.includes(b)) boost.add(a);
        }
        if (boost.size) {
          dist = dist.map(item => ({
            ...item,
            weight: boost.has(item.value) ? item.weight * 1.2 : item.weight
          }));
        }
      }

      return dist;
    };

    while (regularBalls.size < this.config.regularBalls.count && attempts < MAX_ATTEMPTS_PER_BALL_SET) {
      const chosen = Array.from(regularBalls);
      const modifiedDistribution = buildDistribution(chosen);
      const ball = this._weightedRandomPick(modifiedDistribution);

      if (ball >= this.config.regularBalls.min && ball <= this.config.regularBalls.max) {
        // Odd-even balance guard only when picking the last slot
        if (balanceOddEven && regularBalls.size === this.config.regularBalls.count - 1) {
          const odds = chosen.filter(n => n % 2 === 1).length;
          const evens = chosen.length - odds;
          if (Math.abs(odds - evens) > 2) {
            if (odds > evens && ball % 2 === 1) { attempts++; continue; }
            if (evens > odds && ball % 2 === 0) { attempts++; continue; }
          }
        }
        regularBalls.add(ball);
      }
      attempts++;
    }

    // Fill remaining slots randomly if needed
    if (regularBalls.size < this.config.regularBalls.count) {
      const availableNumbers = [];
      for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
        if (!regularBalls.has(i)) availableNumbers.push(i);
      }
      while (regularBalls.size < this.config.regularBalls.count && availableNumbers.length > 0) {
        const randomIndex = Math.floor(this._secureRandomFloat() * availableNumbers.length);
        regularBalls.add(availableNumbers.splice(randomIndex, 1)[0]);
      }
    }

    const powerball = this._weightedRandomPick(this.probabilityDistributions.powerball);
    const sortedRegularBalls = Array.from(regularBalls).sort((a, b) => a - b);

    return {
      regular: sortedRegularBalls,
      powerball
    };
  }

  predict(historicalData, numSetsToGenerate = 5, options = {}) {
    this._preprocessData(historicalData);

    if (this.validHistoricalDraws.length === 0) {
      console.warn("No valid historical data found. Using uniform distribution.");
    }

    this._calculateStatistics();
    this._calculateWeightedFrequencies();
    this._createProbabilityDistributions();

    const predictedSets = [];
    for (let i = 0; i < numSetsToGenerate; i++) {
      let set = null;
      let attempt = 0;
      const MAX_SET_REROLLS = 10;
      do {
        try {
          set = this._generateSingleSet(options);
        } catch (e) {
          console.error(`Error generating set: ${e.message}`);
          set = null;
        }
        attempt++;
      } while (!set && attempt < MAX_SET_REROLLS);

      if (set) {
        predictedSets.push(set);
      }
    }

    return predictedSets.map(s => ({
      regular_balls: s.regular,
      powerball: s.powerball
    }));
  }

  getStatistics() {
    return {
      totalDraws: this.validHistoricalDraws.length,
      hotNumbers: this.statistics.hotNumbers,
      coldNumbers: this.statistics.coldNumbers,
      mostCommonPairs: Array.from(this.statistics.pairFrequencies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      mostCommonTriplets: Array.from(this.statistics.tripletFrequencies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      averageGaps: this._calculateAverageGaps()
    };
  }

  _calculateAverageGaps() {
    const avgGaps = new Map();
    for (const [ball, gaps] of this.statistics.gapAnalysis) {
      if (gaps.length > 0) {
        const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        avgGaps.set(ball, Math.round(avg * 10) / 10);
      }
    }
    return Array.from(avgGaps.entries()).sort((a, b) => a[1] - b[1]);
  }

  validatePredictions(predictions, historicalData) {
    const validation = {
      regularMatches: 0,
      powerballMatches: 0,
      pairMatches: 0,
      tripletMatches: 0
    };

    // Build helper sets for pairs/triplets in predictions
    const predPairs = new Set();
    const predTriplets = new Set();
    for (const pred of predictions) {
      const regs = [...pred.regular_balls].sort((a, b) => a - b);
      // pairs
      for (let i = 0; i < regs.length; i++) {
        for (let j = i + 1; j < regs.length; j++) {
          predPairs.add(`${regs[i]}-${regs[j]}`);
        }
      }
      // triplets
      for (let i = 0; i < regs.length; i++) {
        for (let j = i + 1; j < regs.length; j++) {
          for (let k = j + 1; k < regs.length; k++) {
            predTriplets.add(`${regs[i]}-${regs[j]}-${regs[k]}`);
          }
        }
      }
    }

    predictions.forEach(pred => {
      historicalData.forEach(draw => {
        const histRegular = draw.slice(1, 6).map(Number);
        const histPowerball = Number(draw[6]);

        // Count matching numbers
        const matchingRegular = pred.regular_balls.filter(n => histRegular.includes(n)).length;
        validation.regularMatches += matchingRegular;

        if (pred.powerball === histPowerball) validation.powerballMatches++;

        // pairs/triplets in this historical draw
        const regs = [...histRegular].sort((a, b) => a - b);
        for (let i = 0; i < regs.length; i++) {
          for (let j = i + 1; j < regs.length; j++) {
            if (predPairs.has(`${regs[i]}-${regs[j]}`)) validation.pairMatches++;
          }
        }
        for (let i = 0; i < regs.length; i++) {
          for (let j = i + 1; j < regs.length; j++) {
            for (let k = j + 1; k < regs.length; k++) {
              if (predTriplets.has(`${regs[i]}-${regs[j]}-${regs[k]}`)) validation.tripletMatches++;
            }
          }
        }
      });
    });

    return validation;
  }
}

export const improvedPredictor = new ImprovedLotteryPredictor();
