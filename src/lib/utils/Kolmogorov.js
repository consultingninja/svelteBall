import crypto from 'crypto';
import zlib from 'zlib';

class KolmogorovLotteryPredictor {
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
        const seqString = sequence.map(n => String.fromCharCode(n + 32)).join('');
        const n = seqString.length;
        
        let complexity = 0;
        let i = 0;
        
        while (i < n) {
            let j = i + 1;
            while (j <= n && seqString.substring(0, i).includes(seqString.substring(i, j))) {
                j++;
            }
            complexity++;
            i = j - 1;
        }
        
        // Normalize by theoretical maximum
        const maxComplexity = n / Math.log2(n);
        return Math.min(1, complexity / maxComplexity);
    }

    calculateRandomnessScore(sequence) {
        const scores = {};
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (const [testName, testFn] of Object.entries(this.randomnessTests)) {
            scores[testName] = testFn(sequence);
            weightedSum += scores[testName] * this.testWeights[testName];
            totalWeight += this.testWeights[testName];
        }
        
        const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
        
        return {
            overall: overallScore,
            details: scores
        };
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
                const score = this.calculateRandomnessScore(numbers);
                scores.push(score.overall);
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

// Usage example
export function createKolmogorovCompliantPredictor(basePredictor) {
    const kolmogorovPredictor = new KolmogorovLotteryPredictor();
    
    return {
        predict: function(historicalData, numSetsToGenerate = 5, options = {}) {
            // Calibrate randomness threshold based on historical data
            if (options.autoCalibrate !== false) {
                kolmogorovPredictor.config.randomnessThreshold = 
                    kolmogorovPredictor.calibrateThreshold(historicalData);
            }
            console.log(`Kolm Predictor initialized.`);
            
            // First get base predictions
            basePredictor._preprocessData(historicalData);
            basePredictor._calculateStatistics();
            basePredictor._calculateWeightedFrequencies();
            basePredictor._createProbabilityDistributions();
            
            const predictions = [];
            
            for (let i = 0; i < numSetsToGenerate; i++) {
                const prediction = kolmogorovPredictor.generateWithRandomnessConstraint(
                    () => basePredictor._generateSingleSet(options),
                    options
                );
                
                predictions.push({
                    regular_balls: prediction.regular,
                    powerball: prediction.powerball,
                    randomness_score: prediction.randomnessScore.overall,
                    randomness_details: prediction.randomnessScore.details,
                    generation_attempts: prediction.attempts,
                    was_perturbed: prediction.wasPerturbed || false,
                    below_threshold: prediction.belowThreshold || false
                });
            }
            
            return predictions;
        },
        
        analyzeRandomness: function(sequences) {
            return sequences.map(seq => {
                const fullSeq = [...seq.regular_balls, seq.powerball];
                return kolmogorovPredictor.calculateRandomnessScore(fullSeq);
            });
        },
        
        getConfig: () => kolmogorovPredictor.config,
        setConfig: (newConfig) => Object.assign(kolmogorovPredictor.config, newConfig)
    };
}