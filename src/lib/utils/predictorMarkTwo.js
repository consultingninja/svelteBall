import crypto from 'crypto';

class ImprovedLotteryPredictor {
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
        
        // New features
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
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            try {
                const nodeCrypto = require('crypto');
                if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
                    const buffer = nodeCrypto.randomBytes(4);
                    return buffer.readUInt32BE(0) / (0xFFFFFFFF + 1);
                }
            } catch (e) {}
        }

        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const buffer = new Uint32Array(1);
            crypto.getRandomValues(buffer);
            return buffer[0] / (0xFFFFFFFF + 1);
        }

        console.warn("CSPRNG not available. Falling back to Math.random().");
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
        if (drawNumbers.length !== this.config.regularBalls.count + this.config.powerball.count) {
            return false;
        }

        const regularBalls = drawNumbers.slice(0, this.config.regularBalls.count);
        const powerball = drawNumbers[this.config.regularBalls.count];

        const regularSet = new Set();
        for (const ball of regularBalls) {
            if (ball < this.config.regularBalls.min || ball > this.config.regularBalls.max) {
                return false;
            }
            regularSet.add(ball);
        }
        if (regularSet.size !== this.config.regularBalls.count) {
            return false;
        }

        if (powerball < this.config.powerball.min || powerball > this.config.powerball.max) {
            return false;
        }
        return true;
    }

    _preprocessData(rawData) {
        this.validHistoricalDraws = [];
        for (const rawDraw of rawData) {
            const dateString = rawDraw[0];
            const numbersAsStrings = rawDraw.slice(1);

            if (numbersAsStrings.length !== this.config.regularBalls.count + this.config.powerball.count) {
                continue;
            }

            const numbers = numbersAsStrings.map(Number);
            if (numbers.some(isNaN)) {
                continue;
            }

            if (this._isValidDraw(numbers)) {
                const drawDate = new Date(dateString);
                if (isNaN(drawDate.getTime())) {
                    continue;
                }
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
        // Reset statistics
        const regularFreq = new Map();
        const powerballFreq = new Map();
        this.statistics.pairFrequencies.clear();
        this.statistics.tripletFrequencies.clear();
        this.statistics.gapAnalysis.clear();
        this.statistics.lastSeenMap.clear();

        // Initialize frequency maps
        for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
            regularFreq.set(i, 0);
            this.statistics.gapAnalysis.set(i, []);
        }
        for (let i = this.config.powerball.min; i <= this.config.powerball.max; i++) {
            powerballFreq.set(i, 0);
        }

        // Calculate frequencies and patterns
        this.validHistoricalDraws.forEach((draw, drawIndex) => {
            // Regular ball frequencies
            draw.regular.forEach(ball => {
                regularFreq.set(ball, regularFreq.get(ball) + 1);
                
                // Gap analysis
                const gaps = this.statistics.gapAnalysis.get(ball);
                const lastSeen = this.statistics.lastSeenMap.get(ball);
                if (lastSeen !== undefined) {
                    gaps.push(drawIndex - lastSeen);
                }
                this.statistics.lastSeenMap.set(ball, drawIndex);
            });

            // Powerball frequencies
            powerballFreq.set(draw.powerball, powerballFreq.get(draw.powerball) + 1);

            // Pair frequencies
            for (let i = 0; i < draw.regular.length; i++) {
                for (let j = i + 1; j < draw.regular.length; j++) {
                    const pair = `${draw.regular[i]}-${draw.regular[j]}`;
                    this.statistics.pairFrequencies.set(pair, 
                        (this.statistics.pairFrequencies.get(pair) || 0) + 1);
                }
            }

            // Triplet frequencies
            for (let i = 0; i < draw.regular.length; i++) {
                for (let j = i + 1; j < draw.regular.length; j++) {
                    for (let k = j + 1; k < draw.regular.length; k++) {
                        const triplet = `${draw.regular[i]}-${draw.regular[j]}-${draw.regular[k]}`;
                        this.statistics.tripletFrequencies.set(triplet,
                            (this.statistics.tripletFrequencies.get(triplet) || 0) + 1);
                    }
                }
            }
        });

        // Identify hot and cold numbers
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
                this.weightedFrequencies.regular.set(ball, 
                    (this.weightedFrequencies.regular.get(ball) || 0) + weight);
            }
            this.weightedFrequencies.powerball.set(draw.powerball, 
                (this.weightedFrequencies.powerball.get(draw.powerball) || 0) + weight);
        });
    }

    _createProbabilityDistributions() {
        this.probabilityDistributions.regular = [];
        this.probabilityDistributions.powerball = [];

        // For regular balls
        for (const [number, weight] of this.weightedFrequencies.regular) {
            this.probabilityDistributions.regular.push({ value: number, weight: weight });
        }
        this.probabilityDistributions.regular.sort((a,b) => a.value - b.value);

        // For Powerball
        for (const [number, weight] of this.weightedFrequencies.powerball) {
            this.probabilityDistributions.powerball.push({ value: number, weight: weight });
        }
        this.probabilityDistributions.powerball.sort((a,b) => a.value - b.value);

        // Fill missing numbers with small weights
        if (this.probabilityDistributions.regular.length < this.config.regularBalls.max - this.config.regularBalls.min + 1) {
            const existingNumbers = new Set(this.probabilityDistributions.regular.map(d => d.value));
            for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
                if (!existingNumbers.has(i)) {
                    this.probabilityDistributions.regular.push({ value: i, weight: 0.1 });
                }
            }
            this.probabilityDistributions.regular.sort((a,b) => a.value - b.value);
        }

        if (this.probabilityDistributions.powerball.length < this.config.powerball.max - this.config.powerball.min + 1) {
            const existingNumbers = new Set(this.probabilityDistributions.powerball.map(d => d.value));
            for (let i = this.config.powerball.min; i <= this.config.powerball.max; i++) {
                if (!existingNumbers.has(i)) {
                    this.probabilityDistributions.powerball.push({ value: i, weight: 0.1 });
                }
            }
            this.probabilityDistributions.powerball.sort((a,b) => a.value - b.value);
        }
    }

    _weightedRandomPick(distribution) {
        if (!distribution || distribution.length === 0) {
            throw new Error("Cannot pick from an empty or invalid distribution.");
        }

        let totalWeight = 0;
        for (const item of distribution) {
            totalWeight += item.weight;
        }

        if (totalWeight === 0) {
            const randomIndex = Math.floor(this._secureRandomFloat() * distribution.length);
            return distribution[randomIndex].value;
        }

        const randomValue = this._secureRandomFloat() * totalWeight;
        let cumulativeWeight = 0;

        for (const item of distribution) {
            cumulativeWeight += item.weight;
            if (randomValue < cumulativeWeight) {
                return item.value;
            }
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

        let regularBalls = new Set();
        let attempts = 0;
        const MAX_ATTEMPTS_PER_BALL_SET = 1000;

        // Modify distribution based on options
        let modifiedDistribution = [...this.probabilityDistributions.regular];
        
        if (avoidCold && this.statistics.coldNumbers.regular.length > 0) {
            modifiedDistribution = modifiedDistribution.map(item => ({
                ...item,
                weight: this.statistics.coldNumbers.regular.includes(item.value) 
                    ? item.weight * 0.3 : item.weight
            }));
        }
        
        if (favorHot && this.statistics.hotNumbers.regular.length > 0) {
            modifiedDistribution = modifiedDistribution.map(item => ({
                ...item,
                weight: this.statistics.hotNumbers.regular.includes(item.value) 
                    ? item.weight * 1.5 : item.weight
            }));
        }

        while (regularBalls.size < this.config.regularBalls.count && attempts < MAX_ATTEMPTS_PER_BALL_SET) {
            const ball = this._weightedRandomPick(modifiedDistribution);
            
            if (ball >= this.config.regularBalls.min && ball <= this.config.regularBalls.max) {
                // Apply balance constraints if enabled
                if (balanceOddEven && regularBalls.size === this.config.regularBalls.count - 1) {
                    const odds = Array.from(regularBalls).filter(n => n % 2 === 1).length;
                    const evens = regularBalls.size - odds;
                    if (Math.abs(odds - evens) > 2) {
                        if (odds > evens && ball % 2 === 1) continue;
                        if (evens > odds && ball % 2 === 0) continue;
                    }
                }
                
                regularBalls.add(ball);
            }
            attempts++;
        }

        // Fill remaining slots if needed
        if (regularBalls.size < this.config.regularBalls.count) {
            const availableNumbers = [];
            for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
                if (!regularBalls.has(i)) {
                    availableNumbers.push(i);
                }
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
            powerball: powerball
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
            let set;
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
        // Check how often predicted numbers appeared in historical data
        const validation = {
            regularMatches: 0,
            powerballMatches: 0,
            pairMatches: 0,
            tripletMatches: 0
        };

        predictions.forEach(pred => {
            historicalData.forEach(draw => {
                const histRegular = draw.slice(1, 6).map(Number);
                const histPowerball = Number(draw[6]);

                // Count matching numbers
                const matchingRegular = pred.regular_balls.filter(n => histRegular.includes(n)).length;
                validation.regularMatches += matchingRegular;

                if (pred.powerball === histPowerball) {
                    validation.powerballMatches++;
                }
            });
        });

        return validation;
    }
}

export const improvedPredictor = new ImprovedLotteryPredictor();