import crypto from 'crypto';
import zlib from 'zlib';

export class KolmogorovLotteryPredictor {
    constructor(config = {}) {
        this.config = {
            regularBalls: { min: 1, max: 69, count: 5 },
            powerball: { min: 1, max: 26, count: 1 },
            randomnessThreshold: 0.7, // Minimum randomness score to accept
            maxRejectionAttempts: 100,
            ...config
        };
        
        this.randomnessTests = {
            compressionRatio: this._compressionTest.bind(this),
            entropy: this._entropyTest.bind(this),
            runsTest: this._runsTest.bind(this),
            serialCorrelation: this._serialCorrelationTest.bind(this),
            chiSquare: this._chiSquareTest.bind(this),
            lempelZiv: this._lempelZivComplexity.bind(this)
        };
        
        this.testWeights = {
            compressionRatio: 0.25,
            entropy: 0.20,
            runsTest: 0.15,
            serialCorrelation: 0.15,
            chiSquare: 0.15,
            lempelZiv: 0.10
        };
    }

    _compressionTest(sequence) {
        // Convert sequence to string representation
        const seqString = sequence.join(',');
        const buffer = Buffer.from(seqString, 'utf8');
        
        // Try to compress using gzip
        const compressed = zlib.gzipSync(buffer);
        
        // Calculate compression ratio (lower is more compressible, thus less random)
        const ratio = compressed.length / buffer.length;
        
        // Normalize to 0-1 scale (1 being most random)
        // Typical good random sequences compress to about 0.9-1.1 of original size
        return Math.min(1, Math.max(0, (ratio - 0.5) * 2));
    }

    _entropyTest(sequence) {
        // Calculate Shannon entropy
        const frequencies = new Map();
        const n = sequence.length;
        
        for (const num of sequence) {
            frequencies.set(num, (frequencies.get(num) || 0) + 1);
        }
        
        let entropy = 0;
        for (const [_, freq] of frequencies) {
            const p = freq / n;
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        }
        
        // Normalize by maximum possible entropy
        const maxEntropy = Math.log2(n);
        return maxEntropy > 0 ? entropy / maxEntropy : 0;
    }

    _runsTest(sequence) {
        // Test for runs of consecutive increasing/decreasing numbers
        if (sequence.length < 2) return 1;
        
        let runs = 1;
        let currentRunType = null; // 'up' or 'down'
        
        for (let i = 1; i < sequence.length; i++) {
            const direction = sequence[i] > sequence[i-1] ? 'up' : 'down';
            if (direction !== currentRunType) {
                runs++;
                currentRunType = direction;
            }
        }
        
        // Expected runs for random sequence
        const n = sequence.length;
        const expectedRuns = (2 * n - 1) / 3;
        const variance = (16 * n - 29) / 90;
        
        if (variance <= 0) return 0.5;
        
        // Calculate z-score
        const z = Math.abs(runs - expectedRuns) / Math.sqrt(variance);
        
        // Convert to 0-1 scale (lower z-score is more random)
        return Math.max(0, 1 - z / 3);
    }

    _serialCorrelationTest(sequence) {
        // Test for correlation between consecutive numbers
        if (sequence.length < 2) return 1;
        
        const n = sequence.length;
        let sum1 = 0, sum2 = 0, sum12 = 0;
        
        for (let i = 0; i < n - 1; i++) {
            sum1 += sequence[i];
            sum2 += sequence[i + 1];
            sum12 += sequence[i] * sequence[i + 1];
        }
        
        const mean1 = sum1 / (n - 1);
        const mean2 = sum2 / (n - 1);
        
        let var1 = 0, var2 = 0;
        for (let i = 0; i < n - 1; i++) {
            var1 += Math.pow(sequence[i] - mean1, 2);
            var2 += Math.pow(sequence[i + 1] - mean2, 2);
        }
        
        if (var1 === 0 || var2 === 0) return 0;
        
        const correlation = (sum12 - (n - 1) * mean1 * mean2) / Math.sqrt(var1 * var2);
        
        // Return 1 - |correlation| (perfect randomness has correlation near 0)
        return 1 - Math.abs(correlation);
    }

    _chiSquareTest(sequence) {
        // Test for uniform distribution
        const buckets = 10;
        const counts = new Array(buckets).fill(0);
        const min = Math.min(...sequence);
        const max = Math.max(...sequence);
        const range = max - min;
        
        if (range === 0) return 0;
        
        for (const num of sequence) {
            const bucket = Math.min(buckets - 1, Math.floor((num - min) / range * buckets));
            counts[bucket]++;
        }
        
        const expected = sequence.length / buckets;
        let chiSquare = 0;
        
        for (const count of counts) {
            chiSquare += Math.pow(count - expected, 2) / expected;
        }
        
        // Normalize (lower chi-square means more uniform/random)
        // Using rough approximation for p-value conversion
        const normalized = Math.exp(-chiSquare / (2 * buckets));
        return normalized;
    }

    _lempelZivComplexity(sequence) {
        // Lempel-Ziv complexity as approximation of Kolmogorov complexity
        const seqString = sequence.map(n => String.fromCharCode(Math.abs(n % 95) + 32)).join('');
        const n = seqString.length;
        
        if (n === 0) return 0;
        
        let complexity = 0;
        let i = 0;
        
        while (i < n) {
            let j = i + 1;
            
            // Find longest match in previous substring
            while (j <= n) {
                const currentSubstring = seqString.substring(i, j);
                const previousPart = seqString.substring(0, i);
                
                if (i === 0 || !previousPart.includes(currentSubstring)) {
                    break;
                }
                j++;
            }
            
            complexity++;
            i = Math.max(i + 1, j - 1); // Ensure i always advances
        }
        
        // Normalize by theoretical maximum (avoid division by zero)
        const maxComplexity = Math.max(1, n / Math.log2(Math.max(2, n)));
        return Math.min(1, complexity / maxComplexity);
    }

    calculateRandomnessScore(sequence) {
        const scores = {};
        let weightedSum = 0;
        let totalWeight = 0;
        
        // Add new pattern detection tests
        scores.gapAnalysis = this._gapAnalysisTest(sequence);
        scores.patternDetection = this._patternDetectionTest(sequence);
        scores.duplicateAnalysis = this._duplicateAnalysisTest(sequence);
        
        // Run existing tests
        for (const [testName, testFn] of Object.entries(this.randomnessTests)) {
            scores[testName] = testFn(sequence);
        }
        
        // CRITICAL PATTERN DETECTION - VETO SYSTEM
        // If either gap analysis or pattern detection shows clear patterns, cap the score severely
        const criticalGapFailure = scores.gapAnalysis <= 0.1;
        const criticalPatternFailure = scores.patternDetection <= 0.3;
        const criticalFailure = criticalGapFailure || criticalPatternFailure;
        
        // Updated weights to heavily favor pattern detection
        const allWeights = {
            gapAnalysis: 0.35,        // VERY heavy weight for gap detection
            patternDetection: 0.35,    // VERY heavy weight for pattern detection  
            duplicateAnalysis: 0.10,   // Moderate weight for duplicates
            // Remaining 20% for other tests
            compressionRatio: 0.05,
            entropy: 0.05,
            runsTest: 0.03,
            serialCorrelation: 0.03,
            chiSquare: 0.03,
            lempelZiv: 0.01
        };
        
        // Calculate weighted score
        for (const [testName, score] of Object.entries(scores)) {
            const weight = allWeights[testName] || 0;
            weightedSum += score * weight;
            totalWeight += weight;
        }
        
        let overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
        
        // VETO SYSTEM: Apply severe penalties for obvious patterns
        if (criticalFailure) {
            // If we detect clear patterns, cap the maximum possible score
            const maxAllowedScore = 0.4; // Even with perfect other scores, can't exceed this
            overallScore = Math.min(overallScore, maxAllowedScore);
            
            // Additional penalty based on how bad the pattern detection is
            if (scores.gapAnalysis === 0 && scores.patternDetection <= 0.2) {
                // Perfect arithmetic sequence detected - this is clearly not random
                overallScore = Math.min(overallScore, 0.3);
            }
        }
        
        return {
            overall: overallScore,
            details: scores,
            criticalFailure: criticalFailure,
            vetoApplied: criticalFailure && overallScore <= 0.4
        };
    }

    _gapAnalysisTest(sequence) {
        // Detect sequential patterns and uniform gaps
        if (sequence.length < 2) return 1;
        
        const gaps = [];
        const sortedSeq = [...sequence].sort((a, b) => a - b);
        
        for (let i = 1; i < sortedSeq.length; i++) {
            gaps.push(sortedSeq[i] - sortedSeq[i-1]);
        }
        
        // Check for identical gaps (arithmetic sequence) - STRONGER CHECK
        const uniqueGaps = new Set(gaps);
        if (uniqueGaps.size === 1 && gaps[0] > 0) {
            return 0; // Perfect arithmetic sequence = not random
        }
        
        // Check for mostly identical gaps - CATCH MULTIPLES OF 10
        if (uniqueGaps.size <= 2) {
            const gapArray = Array.from(uniqueGaps);
            const dominantGap = gaps.filter(g => g === gapArray[0]).length;
            if (dominantGap >= gaps.length * 0.6) { // 60% same gap
                return 0.1; // Very low randomness
            }
        }
        
        // Check for mostly small gaps (sequential-like)
        const smallGaps = gaps.filter(g => g <= 3).length; // Gaps of 1, 2, or 3
        const smallGapRatio = smallGaps / gaps.length;
        
        // Calculate randomness score - higher small gap ratio = lower randomness
        let score = 1 - smallGapRatio;
        
        // Additional penalty for very sequential patterns
        if (smallGapRatio > 0.8) {
            score *= 0.3; // Heavy penalty
        }
        
        // Check for zero gaps (duplicates)
        const zeroGaps = gaps.filter(g => g === 0).length;
        if (zeroGaps > 0) {
            score *= (1 - zeroGaps / gaps.length); // Penalize duplicates
        }
        
        // Special check for round number patterns (multiples of 5, 10, etc.)
        const roundNumbers = sortedSeq.filter(n => n % 10 === 0).length;
        if (roundNumbers >= sortedSeq.length * 0.5) { // 50% or more are round
            score *= 0.4; // Heavy penalty for round number patterns
        }
        
        return Math.max(0, score);
    }

    _patternDetectionTest(sequence) {
        // Detect arithmetic and geometric progressions
        if (sequence.length < 3) return 1;
        
        let penalties = 0;
        const maxPenalties = 5; // Increased for more thorough checking
        
        // Check for arithmetic progression in sorted order
        const sortedSeq = [...sequence].sort((a, b) => a - b);
        const diffs = [];
        for (let i = 1; i < sortedSeq.length; i++) {
            diffs.push(sortedSeq[i] - sortedSeq[i-1]);
        }
        
        // Identical differences = arithmetic sequence
        const uniqueDiffs = new Set(diffs);
        if (uniqueDiffs.size === 1 && diffs[0] > 0) {
            penalties += 2; // Heavy penalty for perfect arithmetic
        } else if (uniqueDiffs.size <= 2) {
            penalties += 1; // Moderate penalty for mostly arithmetic
        }
        
        // Check for arithmetic progression in original order
        const originalDiffs = [];
        for (let i = 1; i < sequence.length; i++) {
            originalDiffs.push(sequence[i] - sequence[i-1]);
        }
        const uniqueOriginalDiffs = new Set(originalDiffs.map(d => Math.abs(d)));
        if (uniqueOriginalDiffs.size <= 2) {
            penalties += 1; // Sequential arithmetic pattern
        }
        
        // Check for geometric progression
        const ratios = [];
        for (let i = 1; i < sequence.length; i++) {
            if (sequence[i-1] !== 0 && sequence[i] !== 0) {
                ratios.push(sequence[i] / sequence[i-1]);
            }
        }
        
        if (ratios.length > 0) {
            const uniqueRatios = new Set(ratios.map(r => Math.round(r * 100) / 100));
            if (uniqueRatios.size === 1) {
                penalties += 2; // Perfect geometric progression
            } else if (uniqueRatios.size <= 2) {
                penalties += 1; // Mostly geometric
            }
        }
        
        // Check for multiples pattern (common divisor)
        const nonZeroSeq = sequence.filter(n => n > 0);
        if (nonZeroSeq.length > 1) {
            const gcd = this._findGCD(nonZeroSeq);
            if (gcd > 1) {
                const avgNum = nonZeroSeq.reduce((a, b) => a + b) / nonZeroSeq.length;
                if (gcd >= avgNum / 10) { // If GCD is significant relative to average
                    penalties += 1;
                }
            }
        }
        
        // Check for powers pattern
        const isPowerSequence = this._checkPowerPattern(sequence);
        if (isPowerSequence) {
            penalties += 2;
        }
        
        return Math.max(0, 1 - (penalties / maxPenalties));
    }

    _checkPowerPattern(sequence) {
        // Check if sequence follows a power pattern (like 2, 4, 8, 16...)
        if (sequence.length < 3) return false;
        
        for (let base = 2; base <= 5; base++) {
            let matches = 0;
            for (const num of sequence) {
                for (let exp = 1; exp <= 10; exp++) {
                    if (Math.pow(base, exp) === num) {
                        matches++;
                        break;
                    }
                }
            }
            if (matches >= sequence.length * 0.6) { // 60% or more are powers
                return true;
            }
        }
        return false;
    }

    _duplicateAnalysisTest(sequence) {
        // Penalize duplicate numbers (shouldn't happen in lottery)
        const unique = new Set(sequence);
        const duplicateRatio = 1 - (unique.size / sequence.length);
        return 1 - duplicateRatio;
    }

    _findGCD(numbers) {
        // Find greatest common divisor of array, filtering out zeros and negatives
        const positiveNumbers = numbers.filter(n => n > 0);
        if (positiveNumbers.length === 0) return 1;
        if (positiveNumbers.length === 1) return positiveNumbers[0];
        
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        return positiveNumbers.reduce((acc, num) => gcd(acc, num));
    }

    _perturbSequence(sequence, strength = 0.1) {
        // Add small random perturbations to improve randomness
        const perturbed = [...sequence];
        const numChanges = Math.max(1, Math.floor(sequence.length * strength));
        
        for (let i = 0; i < numChanges; i++) {
            const idx = Math.floor(this._secureRandomFloat() * perturbed.length);
            const direction = this._secureRandomFloat() < 0.5 ? -1 : 1;
            const magnitude = Math.floor(this._secureRandomFloat() * 3) + 1;
            
            const newValue = perturbed[idx] + direction * magnitude;
            
            // Keep within valid range
            if (idx < this.config.regularBalls.count) {
                if (newValue >= this.config.regularBalls.min && 
                    newValue <= this.config.regularBalls.max &&
                    !perturbed.slice(0, this.config.regularBalls.count).includes(newValue)) {
                    perturbed[idx] = newValue;
                }
            } else {
                if (newValue >= this.config.powerball.min && 
                    newValue <= this.config.powerball.max) {
                    perturbed[idx] = newValue;
                }
            }
        }
        
        // Re-sort regular balls
        const regular = perturbed.slice(0, this.config.regularBalls.count).sort((a, b) => a - b);
        const powerball = perturbed[this.config.regularBalls.count];
        
        return [...regular, powerball];
    }

    _secureRandomFloat() {
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const buffer = new Uint32Array(1);
            crypto.getRandomValues(buffer);
            return buffer[0] / (0xFFFFFFFF + 1);
        }
        return Math.random();
    }

    generateWithRandomnessConstraint(baseGenerator, options = {}) {
        let attempts = 0;
        let bestCandidate = null;
        let bestScore = 0;
        
        while (attempts < this.config.maxRejectionAttempts) {
            // Generate candidate using base strategy
            const candidate = baseGenerator();
            const fullSequence = [...candidate.regular, candidate.powerball];
            
            // Calculate randomness score
            const randomnessScore = this.calculateRandomnessScore(fullSequence);
            
            // Keep track of best candidate
            if (randomnessScore.overall > bestScore) {
                bestScore = randomnessScore.overall;
                bestCandidate = {
                    sequence: candidate,
                    randomnessScore: randomnessScore
                };
            }
            
            // Accept if meets threshold
            if (randomnessScore.overall >= this.config.randomnessThreshold) {
                return {
                    ...candidate,
                    randomnessScore: randomnessScore,
                    attempts: attempts + 1
                };
            }
            
            // Try perturbation to improve randomness
            if (attempts % 10 === 5) {
                const perturbed = this._perturbSequence(fullSequence, 0.2);
                const perturbedScore = this.calculateRandomnessScore(perturbed);
                
                if (perturbedScore.overall >= this.config.randomnessThreshold) {
                    return {
                        regular: perturbed.slice(0, this.config.regularBalls.count),
                        powerball: perturbed[this.config.regularBalls.count],
                        randomnessScore: perturbedScore,
                        attempts: attempts + 1,
                        wasPerturbed: true
                    };
                }
            }
            
            attempts++;
        }
        
        // Return best candidate found if threshold never met
        console.warn(`Could not generate sequence meeting randomness threshold ${this.config.randomnessThreshold} after ${attempts} attempts. Returning best found with score ${bestScore.toFixed(3)}`);
        
        return {
            ...bestCandidate.sequence,
            randomnessScore: bestCandidate.randomnessScore,
            attempts: attempts,
            belowThreshold: true
        };
    }

    calibrateThreshold(historicalData) {
        // Analyze historical draws to set appropriate randomness threshold
        const scores = [];
        
        for (const draw of historicalData) {
            const numbers = draw.slice(1).map(Number);
            if (numbers.length === this.config.regularBalls.count + 1) {
                const result = this.calculateRandomnessScore(numbers);
                scores.push(result.overall);
            }
        }
        
        if (scores.length === 0) {
            console.warn("No valid historical data for calibration");
            return this.config.randomnessThreshold;
        }
        
        // Calculate statistics
        scores.sort((a, b) => a - b);
        const mean = scores.reduce((a, b) => a + b) / scores.length;
        const percentile25 = scores[Math.floor(scores.length * 0.25)];
        const percentile75 = scores[Math.floor(scores.length * 0.75)];
        
        console.log(`Historical randomness scores - Mean: ${mean.toFixed(3)}, 25th percentile: ${percentile25.toFixed(3)}, 75th percentile: ${percentile75.toFixed(3)}`);
        
        // Set threshold to 25th percentile (accept 75% of historical-like randomness)
        return percentile25;
    }
}

// Usage example - FIXED VERSION
export function createKolmogorovCompliantPredictor(basePredictor) {
    console.log("🚀 Initializing Kolmogorov Lottery Predictor...");
    let kolmogorovPredictor = null;
    try{
        console.log("📊 Creating KolmogorovLotteryPredictor instance...");
        kolmogorovPredictor = new KolmogorovLotteryPredictor();
        console.log("✅ KolmogorovLotteryPredictor instance created successfully");
    } catch (error) {
        console.error("❌ Error initializing Kolmogorov Predictor:", error);
        throw error;
    }
    if (!kolmogorovPredictor) {
        throw new Error("Failed to initialize KolmogorovLotteryPredictor");
    }
    
    return {
        predict: function(historicalData, numSetsToGenerate = 5, options = {}) {
            console.log(`🎯 Starting Kolmogorov prediction for ${numSetsToGenerate} sets...`);
            
            // Calibrate randomness threshold based on historical data
            if (options.autoCalibrate !== false) {
                console.log("📈 Auto-calibrating randomness threshold...");
                try {
                    kolmogorovPredictor.config.randomnessThreshold = 
                        kolmogorovPredictor.calibrateThreshold(historicalData);
                    console.log(`✅ Threshold calibrated to: ${kolmogorovPredictor.config.randomnessThreshold.toFixed(3)}`);
                } catch (err) {
                    console.error("❌ Error during calibration:", err.message);
                    throw err;
                }
            }
            console.log(`🎲 Kolm Predictor initialized with threshold: ${kolmogorovPredictor.config.randomnessThreshold.toFixed(3)}`);
            
            const predictions = [];
            
            for (let i = 0; i < numSetsToGenerate; i++) {
                console.log(`🔄 Generating prediction ${i + 1}/${numSetsToGenerate}...`);
                
                const prediction = kolmogorovPredictor.generateWithRandomnessConstraint(
                    () => {
                        
                        console.log("📞 Calling base predictor with single prediction...");
                        const basePredictions = basePredictor.predict(historicalData, 1, options);
                        console.log("📨 Base prediction received:", basePredictions[0]);
                        
                        // Convert to expected format
                        return {
                            regular: basePredictions[0].regular_balls,
                            powerball: basePredictions[0].powerball
                        };
                    },
                    options
                );
                
                predictions.push({
                    regular_balls: prediction.regular,
                    powerball: prediction.powerball,
                    randomness_score: prediction.randomnessScore.overall,
                    randomness_details: prediction.randomnessScore.details,
                    generation_attempts: prediction.attempts,
                    was_perturbed: prediction.wasPerturbed || false,
                    below_threshold: prediction.belowThreshold || false,
                    critical_failure: prediction.randomnessScore.criticalFailure || false,
                    veto_applied: prediction.randomnessScore.vetoApplied || false
                });
            }
            
            console.log(`🎉 Successfully generated ${predictions.length} Kolmogorov-compliant predictions`);
            return predictions;
        },
        
        analyzeRandomness: function(sequences) {
            return sequences.map(seq => {
                const fullSeq = [...seq.regular_balls, seq.powerball];
                const result = kolmogorovPredictor.calculateRandomnessScore(fullSeq);
                return {
                    overall: result.overall,
                    details: result.details,
                    criticalFailure: result.criticalFailure,
                    vetoApplied: result.vetoApplied
                };
            });
        },
        
        getConfig: () => kolmogorovPredictor.config,
        setConfig: (newConfig) => Object.assign(kolmogorovPredictor.config, newConfig)
    };
}