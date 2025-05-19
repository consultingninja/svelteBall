import crypto from 'crypto'; // Node.js crypto module for CSPRNG

class LotteryPredictor {
    constructor() {
        this.config = {
            regularBalls: { min: 1, max: 69, count: 5 },
            powerball: { min: 1, max: 26, count: 1 }
        };
        this.validHistoricalDraws = []; // Will now store { date: Date, regular: [], powerball: num }
        this.weightedFrequencies = {
            regular: new Map(),
            powerball: new Map()
        };
        this.probabilityDistributions = {
            regular: [],
            powerball: []
        };
    }

    _secureRandomFloat() {
        // 1. Try Node.js 'crypto' module's randomBytes first if in Node.js
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            try {
                const nodeCrypto = require('crypto'); // Dynamically require for Node.js
                if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
                    const buffer = nodeCrypto.randomBytes(4); // 4 bytes for a 32-bit integer
                    // Read an unsigned 32-bit integer from the buffer (Big Endian)
                    // and normalize to a float between 0 (inclusive) and 1 (exclusive)
                    return buffer.readUInt32BE(0) / (0xFFFFFFFF + 1);
                }
            } catch (e) {
                // Silently fail or log, then fall through to Web Crypto API
                // console.warn("Node.js crypto.randomBytes not available or failed, trying global crypto API.", e);
            }
        }

        // 2. Try Web Crypto API (browsers and modern Node.js global)
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const buffer = new Uint32Array(1);
            crypto.getRandomValues(buffer);
            return buffer[0] / (0xFFFFFFFF + 1); // 2^32
        }

        // 3. Fallback (least secure)
        console.warn("CSPRNG (Node.js crypto.randomBytes or Web crypto.getRandomValues) not available. " +
                     "Falling back to Math.random(). THIS IS NOT SECURE FOR PRODUCTION SYSTEMS.");
        return Math.random();
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
                // console.warn(`Skipping draw due to incorrect number of items: ${rawDraw}`);
                continue;
            }

            const numbers = numbersAsStrings.map(Number);
            if (numbers.some(isNaN)) {
                // console.warn(`Skipping draw due to non-numeric ball value: ${rawDraw}`);
                continue;
            }

            if (this._isValidDraw(numbers)) {
                const drawDate = new Date(dateString);
                if (isNaN(drawDate.getTime())) {
                    // console.warn(`Skipping draw due to invalid date format: ${dateString}`);
                    continue;
                }
                this.validHistoricalDraws.push({
                    date: drawDate,
                    regular: numbers.slice(0, this.config.regularBalls.count),
                    powerball: numbers[this.config.regularBalls.count]
                });
            }
        }

        // **NEW**: Sort the valid historical draws by date, oldest to newest
        this.validHistoricalDraws.sort((a, b) => a.date.getTime() - b.date.getTime());

        // console.log(`Found ${this.validHistoricalDraws.length} valid historical draws, sorted by date.`);
        // if (this.validHistoricalDraws.length > 0) {
        //     console.log("Oldest valid draw:", this.validHistoricalDraws[0].date.toDateString());
        //     console.log("Newest valid draw:", this.validHistoricalDraws[this.validHistoricalDraws.length - 1].date.toDateString());
        // }
    }

    _calculateWeightedFrequencies() {
        this.weightedFrequencies.regular.clear();
        this.weightedFrequencies.powerball.clear();

        if (this.validHistoricalDraws.length === 0) return;

        // Linear weighting: oldest (after sorting) gets weight 1, next 2, ..., newest N
        this.validHistoricalDraws.forEach((draw, index) => {
            const weight = index + 1;

            for (const ball of draw.regular) {
                this.weightedFrequencies.regular.set(ball, (this.weightedFrequencies.regular.get(ball) || 0) + weight);
            }
            this.weightedFrequencies.powerball.set(draw.powerball, (this.weightedFrequencies.powerball.get(draw.powerball) || 0) + weight);
        });
        // console.log("Weighted Frequencies (Regular):", Array.from(this.weightedFrequencies.regular.entries()));
        // console.log("Weighted Frequencies (Powerball):", Array.from(this.weightedFrequencies.powerball.entries()));
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

        if (this.probabilityDistributions.regular.length === 0) {
            console.warn("No valid historical data for regular balls. Using uniform distribution.");
            for (let i = this.config.regularBalls.min; i <= this.config.regularBalls.max; i++) {
                this.probabilityDistributions.regular.push({ value: i, weight: 1 });
            }
        }
        if (this.probabilityDistributions.powerball.length === 0) {
            console.warn("No valid historical data for powerball. Using uniform distribution.");
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
            // All weights are zero, pick uniformly from the values present
            // This also handles the case where historical data existed, but all resulted in 0 weight somehow (unlikely with linear positive weights)
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
        return distribution[distribution.length - 1].value; // Fallback
    }

    _generateSingleSet() {
        let regularBalls = new Set();
        let attempts = 0;
        const MAX_ATTEMPTS_PER_BALL_SET = 1000;

        while (regularBalls.size < this.config.regularBalls.count && attempts < MAX_ATTEMPTS_PER_BALL_SET) {
            const ball = this._weightedRandomPick(this.probabilityDistributions.regular);
            if (ball >= this.config.regularBalls.min && ball <= this.config.regularBalls.max) {
                 regularBalls.add(ball);
            }
            attempts++;
        }

        if (regularBalls.size < this.config.regularBalls.count) {
            console.warn(`Could not generate ${this.config.regularBalls.count} unique regular balls via weighted pick after ${MAX_ATTEMPTS_PER_BALL_SET} attempts. Filling remaining uniformly.`);
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
            if (regularBalls.size < this.config.regularBalls.count) {
                 throw new Error("Failed to generate a full set of unique regular balls even with fallback.");
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
        this._preprocessData(historicalData); // Now includes sorting by date

        if (this.validHistoricalDraws.length === 0) {
            console.warn("No valid historical data found after preprocessing. Predictions will be based on uniform random choices within game rules.");
        }

        this._calculateWeightedFrequencies();
        this._createProbabilityDistributions();

        const predictedSets = [];
        for (let i = 0; i < numSetsToGenerate; i++) {
            let set;
            let attempt = 0;
            const MAX_SET_REROLLS = 10;
            do {
                try {
                    set = this._generateSingleSet();
                } catch (e) {
                    console.error(`Error generating a single set on attempt ${attempt + 1}: ${e.message}`);
                    set = null; // Ensure set is null if an error occurred
                }
                attempt++;
            } while (!set && attempt < MAX_SET_REROLLS);

            if (set) {
                predictedSets.push(set);
            } else {
                console.error(`Failed to generate prediction set ${i+1} after ${MAX_SET_REROLLS} re-rolls or due to persistent errors.`);
            }
        }

        return predictedSets.map(s => ({
            regular_balls: s.regular,
            powerball: s.powerball
        }));
    }
}

export const predictor = new LotteryPredictor();
