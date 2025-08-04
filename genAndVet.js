// generateAndVet.js

import { DataRetriever } from './src/lib/utils/dataRetriever.js';
import { extractData } from './src/routes/api/ai/utils.js';
import { ImprovedLotteryPredictor } from './src/lib/utils/predictorMarkTwo.js';

// ===================================================================
// === STEP 1: INCLUDE THE NECESSARY PREDICTOR CLASSES
// ===================================================================

// Using the final, calibrated version of the PatternVettingPredictor
export class PatternVettingPredictor {
    constructor(config = {}) {
        this.config = {
            regularBalls: { min: 1, max: 69, count: 5 },
            // --- VETO RULES CONFIGURATION ---
            maxAllowedConsecutive: 3,
            // oddEvenBalance: { minOdd: 1, maxOdd: 4 },
            // highLowBalance: { highMark: 35, minHigh: 1, maxHigh: 4 },
            sumRange: { min: 25, max: 300 },
            maxAllowedLastDigits: 4,
            minUniqueGaps: 2,
            maxInOneDecade: 4,
            ...config
        };
    }

    /**
     * Main vetting function. Runs all checks.
     * Returns a veto reason if a check fails, otherwise returns null.
     */
    // Helper for GCD
    _gcd = (a, b) => b === 0 ? a : this._gcd(b, a % b);

    vet(sequence) {
        const regular = sequence.regular_balls.sort((a, b) => a - b);
        // const powerball = sequence.powerball;
        const checks = [
            () => this._checkConsecutive(regular),
            // () => this._checkOddEven(regular), // REMOVED
            // () => this._checkHighLow(regular), // REMOVED
            () => this._checkSum(regular),
            () => this._checkArithmeticProgression(regular),
            () => this._checkLastDigits(regular),
            () => this._checkGapVariety(regular),
            () => this._checkNumberClustering(regular),
            () => this._checkCommonDivisor(regular),
            // () => this._checkPowerballProximity(regular, powerball) // REMOVED
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
            if (count >= this.config.maxAllowedLastDigits) {
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
            gaps.add(sequence[i+1] - sequence[i]);
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
            const decade = Math.floor(num / 10);
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
            if (sequence[i+1] - sequence[i] === 1) {
                consecutiveCount++;
                if (consecutiveCount > this.config.maxAllowedConsecutive) {
                    return `Vetoed: Found ${consecutiveCount} consecutive numbers.`;
                }
            } else {
                consecutiveCount = 1; // Reset counter
            }
        }
        return null;
    }

    // Veto if all numbers are odd or all are even
    _checkOddEven(sequence) {
        const oddCount = sequence.filter(n => n % 2 !== 0).length;
        if (oddCount < this.config.oddEvenBalance.minOdd || oddCount > this.config.oddEvenBalance.maxOdd) {
            return `Vetoed: Unbalanced odd/even count (${oddCount} odds).`;
        }
        return null;
    }

    // Veto if all numbers are high or all are low
    _checkHighLow(sequence) {
        const highCount = sequence.filter(n => n >= this.config.highLowBalance.highMark).length;
        if (highCount < this.config.highLowBalance.minHigh || highCount > this.config.highLowBalance.maxHigh) {
            return `Vetoed: Unbalanced high/low count (${highCount} high numbers).`;
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

    // Veto if the numbers form a perfect arithmetic progression (e.g., 5, 10, 15, 20, 25)
    _checkArithmeticProgression(sequence) {
        if (sequence.length < 3) return null;
        const gaps = new Set();
        for (let i = 0; i < sequence.length - 1; i++) {
            gaps.add(sequence[i+1] - sequence[i]);
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
            if(result === 1) {
            return 1;
            }
        }
        return result;
    }

    // Add this function to the class:
    _checkCommonDivisor(sequence) {
        const gcd = this._findSetGcd(sequence);
        if (gcd > 2) {
            return `Vetoed: All numbers share a common divisor of ${gcd}.`;
        }
        return null;
    }

    // Veto if the powerball is too close to any regular ball
    _checkPowerballProximity(regular, powerball) {
        for (const num of regular) {
            if (powerball === num || powerball === num - 1 || powerball === num + 1) {
                return `Vetoed: Powerball (${powerball}) is too close to a regular ball (${num}).`;
            }
        }
        return null;
    }

}


// ===================================================================
// === STEP 2: THE MAIN SIMULATION FUNCTION
// ===================================================================

async function generateAndVetSets() {
    console.log("🚀 Starting Generation & Vetting Simulation...");

    const SETS_TO_GENERATE = 5000;

    // Instantiate our two main components
    const vetor = new PatternVettingPredictor();
    const generator = new ImprovedLotteryPredictor();

    // --- Load historical data to prime the generator ---
    console.log("Loading historical data to prepare the generator...");
    const dataRetriever = new DataRetriever('data.csv');
    const result = await dataRetriever.getOrCreateData();
    const csvData = result.csvData;
    const historicalData = extractData(csvData);

    if (historicalData.length === 0) {
        console.error("❌ Cannot run simulation without historical data for the generator.");
        return;
    }
    console.log("Generator is ready.");

    // --- Simulation Loop ---
    let acceptedCount = 0;
    let vetoedCount = 0;
    const vetoReasons = new Map();

    console.log(`\n🔄 Generating and vetting ${SETS_TO_GENERATE} sets...`);

    for (let i = 0; i < SETS_TO_GENERATE; i++) {
        // Show progress for long runs
        if ((i + 1) % 500 === 0) {
            console.log(`...processed ${i + 1} / ${SETS_TO_GENERATE}`);
        }

        // 1. Generate one set using the historical data-driven predictor
        const generatedSets = generator.predict(historicalData, 1);
        const setToTest = generatedSets[0];

        // 2. Vet the generated set against our rules
        const result = vetor.vet(setToTest);

        // 3. Tally the results
        if (result.isVetoed) {
            vetoedCount++;
            vetoReasons.set(result.reason, (vetoReasons.get(result.reason) || 0) + 1);
        } else {
            acceptedCount++;
        }
    }

    // --- Display Final Report ---
    console.log("\n✅ Simulation Complete. Here are the results:\n");
    console.log("-----------------------------------------");
    console.log(`Total Sets Generated: ${SETS_TO_GENERATE}`);
    console.log(`Total Sets Accepted:  ${acceptedCount}`);
    console.log(`Total Sets Vetoed:    ${vetoedCount}`);
    const acceptancePercentage = ((acceptedCount / SETS_TO_GENERATE) * 100).toFixed(2);
    console.log(`\nAcceptance Rate: ${acceptancePercentage}%`);
    console.log("-----------------------------------------");

    if (vetoedCount > 0) {
        console.log("\n📊 Breakdown of Veto Reasons for Generated Sets:\n");
        const sortedReasons = [...vetoReasons.entries()].sort((a, b) => b[1] - a[1]);
        
        for (const [reason, count] of sortedReasons) {
            const reasonPercentage = ((count / vetoedCount) * 100).toFixed(1);
            console.log(`${reason.padEnd(65)} | Count: ${String(count).padEnd(5)} | (${reasonPercentage}%)`);
        }
    } else {
        console.log("\n🎉 Perfect! All generated sets were accepted by the vetting rules.");
    }
}

// ===================================================================
// === STEP 3: RUN THE SIMULATION
// ===================================================================

generateAndVetSets();