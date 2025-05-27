import crypto from 'crypto';

class SweetSpotLotteryPredictor {
    constructor() {
        this.config = {
            regularBalls: { min: 1, max: 69, count: 5 },
            powerball: { min: 1, max: 26, count: 1 }
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
        
        // Sweet spot configuration
        this.strategies = ['linear', 'exponential', 'logarithmic', 'recency', 'hybrid'];
        this.sweetSpotConfig = {
            minEntropy: 0.65,          // Minimum randomness required
            maxConsecutive: 2,         // Max consecutive numbers allowed
            maxMultiples: 2,           // Max numbers that are multiples of 5 or 10
            balanceOddEven: true,      // Prefer 2-3 or 3-2 odd/even split
            avoidExtremes: true        // Avoid all high or all low numbers
        };
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

        return Math.random();
    }

    _getWeightingFunction(strategy) {
        const total = this.validHistoricalDraws.length;
        
        switch(strategy) {
            case 'linear':
                return (index) => index + 1;
            case 'exponential':
                return (index) => Math.pow(1.05, index);
            case 'logarithmic':
                return (index) => Math.log(index + 2) * 10;
            case 'recency':
                return (index) => Math.pow((index + 1) / total, 1.5) * 100;
            case 'hybrid':
                // Combination: recent draws get more weight, but not exponentially
                return (index) => {
                    const recencyFactor = (index + 1) / total;
                    const ageFactor = Math.log(index + 2);
                    return recencyFactor * ageFactor * 50;
                };
            default:
                return (index) => 1;
        }
    }

    _checkSweetSpot(numbers) {
        // Quick checks to ensure we're in the "sweet spot" of randomness
        
        // 1. Check for too many consecutive numbers
        let consecutiveCount = 0;
        for (let i = 1; i < numbers.length; i++) {
            if (numbers[i] === numbers[i-1] + 1) {
                consecutiveCount++;
                if (consecutiveCount >= this.sweetSpotConfig.maxConsecutive) {
                    return false;
                }
            } else {
                consecutiveCount = 0;
            }
        }
        
        // 2. Check for too many multiples of 5 or 10
        const multiples = numbers.filter(n => n % 5 === 0).length;
        if (multiples > this.sweetSpotConfig.maxMultiples) {
            return false;
        }
        
        // 3. Check odd/even balance
        if (this.sweetSpotConfig.balanceOddEven) {
            const odds = numbers.filter(n => n % 2 === 1).length;
            if (odds === 0 || odds === numbers.length) {
                return false; // All odd or all even is too patterned
            }
        }
        
        // 4. Check for extremes (all high or all low)
        if (this.sweetSpotConfig.avoidExtremes) {
            const midpoint = (this.config.regularBalls.max + this.config.regularBalls.min) / 2;
            const highNumbers = numbers.filter(n => n > midpoint).length;
            if (highNumbers === 0 || highNumbers === numbers.length) {
                return false; // All high or all low is suspicious
            }
        }
        
        // 5. Simple entropy check
        const uniqueDigits = new Set();
        numbers.forEach(n => {
            n.toString().split('').forEach(d => uniqueDigits.add(d));
        });
        const entropy = uniqueDigits.size / 10; // Normalize by possible digits
        if (entropy < this.sweetSpotConfig.minEntropy) {
            return false;
        }
        
        return true;
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

    _calculateWeightedFrequencies(strategy) {
        this.weightedFrequencies.regular.clear();
        this.weightedFrequencies.powerball.clear();

        if (this.validHistoricalDraws.length === 0) return;

        const weightingFunction = this._getWeightingFunction(strategy);

        this.validHistoricalDraws.forEach((draw, index) => {
            const weight = weightingFunction(index);

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

        // Regular balls
        for (const [number, weight] of this.weightedFrequencies.regular) {
            this.probabilityDistributions.regular.push({ value: number, weight: weight });
        }
        this.probabilityDistributions.regular.sort((a,b) => a.value - b.value);

        // Powerball
        for (const [number, weight] of this.weightedFrequencies.powerball) {
            this.probabilityDistributions.powerball.push({ value: number, weight: weight });
        }
        this.probabilityDistributions.powerball.sort((a,b) => a.value - b.value);

        // Fill missing numbers with small weights
        if (this.probabilityDistributions.regular.length === 0) {
            for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
                this.probabilityDistributions.regular.push({ value: i, weight: 1 });
            }
        } else {
            // Add missing numbers with 10% of minimum weight
            const minWeight = Math.min(...this.probabilityDistributions.regular.map(d => d.weight));
            const existingNumbers = new Set(this.probabilityDistributions.regular.map(d => d.value));
            
            for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
                if (!existingNumbers.has(i)) {
                    this.probabilityDistributions.regular.push({ value: i, weight: minWeight * 0.1 });
                }
            }
            this.probabilityDistributions.regular.sort((a,b) => a.value - b.value);
        }

        if (this.probabilityDistributions.powerball.length === 0) {
            for (let i = this.config.powerball.min; i <= this.config.powerball.max; i++) {
                this.probabilityDistributions.powerball.push({ value: i, weight: 1 });
            }
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

    _generateSingleSet() {
        let regularBalls = new Set();
        let attempts = 0;
        const MAX_ATTEMPTS_PER_BALL = 100;

        // Generate regular balls
        while (regularBalls.size < this.config.regularBalls.count && attempts < MAX_ATTEMPTS_PER_BALL) {
            const ball = this._weightedRandomPick(this.probabilityDistributions.regular);
            if (ball >= this.config.regularBalls.min && ball <= this.config.regularBalls.max) {
                regularBalls.add(ball);
            }
            attempts++;
        }

        // Fill if needed
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

    predict(historicalData, numSetsToGenerate = 5) {
        this._preprocessData(historicalData);

        if (this.validHistoricalDraws.length === 0) {
            console.warn("No valid historical data found. Using uniform random distribution.");
        }

        const predictedSets = [];
        
        for (let i = 0; i < numSetsToGenerate; i++) {
            // Rotate through strategies for each set
            const strategy = this.strategies[i % this.strategies.length];
            
            // Calculate frequencies and distributions for this strategy
            this._calculateWeightedFrequencies(strategy);
            this._createProbabilityDistributions();
            
            let set = null;
            let attempts = 0;
            const MAX_ATTEMPTS = 50; // More attempts since we're checking sweet spot
            
            while (!set && attempts < MAX_ATTEMPTS) {
                const candidate = this._generateSingleSet();
                
                // Check if it's in the sweet spot
                if (this._checkSweetSpot(candidate.regular)) {
                    set = candidate;
                    set.strategy = strategy;
                    set.attempts = attempts + 1;
                } else {
                    // Try again with slightly adjusted weights if failing too much
                    if (attempts > 20 && attempts % 10 === 0) {
                        // Add some randomness to break patterns
                        this.probabilityDistributions.regular.forEach(item => {
                            item.weight = item.weight * (0.8 + this._secureRandomFloat() * 0.4);
                        });
                    }
                }
                attempts++;
            }
            
            if (set) {
                predictedSets.push(set);
            } else {
                console.warn(`Set ${i+1} failed sweet spot after ${MAX_ATTEMPTS} attempts with ${strategy} strategy`);
                // Fall back to the last successful candidate if we have one
                const fallback = this._generateSingleSet();
                fallback.strategy = strategy;
                fallback.attempts = MAX_ATTEMPTS;
                fallback.warning = "Failed sweet spot checks";
                predictedSets.push(fallback);
            }
        }

        return predictedSets.map(s => ({
            regular_balls: s.regular,
            powerball: s.powerball,
            strategy_used: s.strategy,
            generation_attempts: s.attempts,
            warning: s.warning
        }));
    }

    // Additional utility method to analyze your historical data
    analyzeHistoricalPatterns(historicalData) {
        this._preprocessData(historicalData);
        
        const analysis = {
            totalDraws: this.validHistoricalDraws.length,
            frequencyMap: new Map(),
            consecutiveOccurrences: 0,
            multiplesOf5: 0,
            oddEvenRatios: { balanced: 0, extreme: 0 },
            strategies: {}
        };
        
        // Analyze each historical draw
        this.validHistoricalDraws.forEach(draw => {
            // Count frequencies
            draw.regular.forEach(ball => {
                analysis.frequencyMap.set(ball, (analysis.frequencyMap.get(ball) || 0) + 1);
            });
            
            // Check for consecutive numbers
            for (let i = 1; i < draw.regular.length; i++) {
                if (draw.regular[i] === draw.regular[i-1] + 1) {
                    analysis.consecutiveOccurrences++;
                }
            }
            
            // Count multiples of 5
            analysis.multiplesOf5 += draw.regular.filter(n => n % 5 === 0).length;
            
            // Odd/even ratio
            const odds = draw.regular.filter(n => n % 2 === 1).length;
            if (odds >= 2 && odds <= 3) {
                analysis.oddEvenRatios.balanced++;
            } else {
                analysis.oddEvenRatios.extreme++;
            }
        });
        
        // Test each strategy
        this.strategies.forEach(strategy => {
            this._calculateWeightedFrequencies(strategy);
            const topNumbers = Array.from(this.weightedFrequencies.regular.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([num]) => num);
            
            analysis.strategies[strategy] = {
                top10Numbers: topNumbers,
                totalWeight: Array.from(this.weightedFrequencies.regular.values())
                    .reduce((sum, w) => sum + w, 0)
            };
        });
        
        return analysis;
    }
}

export const sweetSpotPredictor = new SweetSpotLotteryPredictor();