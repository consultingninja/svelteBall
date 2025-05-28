import { ImprovedLotteryPredictor } from './predictorMarkTwo.js';
import { createKolmogorovCompliantPredictor } from './Kolmogorov.js';
import { DataRetriever } from "./dataRetriever.js";
import { extractData } from "../../routes/api/ai/utils.js";

async function Run() {
    console.log("🚀 Starting Kolmogorov Lottery Predictor Test...");
    
    try {
        // 1. Get the data
        console.log("📁 Retrieving data...");
        const dataRetriever = new DataRetriever('recentData.csv');
        const result = await dataRetriever.getOrCreateData();
        const csvData = result.csvData;
        const extractedData = extractData(csvData);
        console.log("✅ Data extracted successfully, rows:", extractedData.length);

        // 2. Test the base improved predictor first
        console.log("\n🧪 Testing base improved predictor...");
        const improvedPredictor = new ImprovedLotteryPredictor(extractedData, 5, {});
        const baseResults = improvedPredictor.predict(extractedData, 5, {
            autoCalibrate: true,
            favorHot: true
        });
        console.log("✅ Base predictor working:", baseResults.length, "predictions generated");
        console.log("Sample base prediction:", baseResults[0]);

        // 3. Create and test Kolmogorov predictor
        console.log("\n🎲 Creating Kolmogorov-compliant predictor...");
        const kolmogorovPredictor = createKolmogorovCompliantPredictor(improvedPredictor);
        console.log("✅ Kolmogorov predictor created successfully");

        // 4. Test with minimal parameters first
        console.log("\n🔬 Testing Kolmogorov predictor with minimal params...");
        const testResult = kolmogorovPredictor.predict(extractedData.slice(0, 10), 1, {});
        console.log("✅ Minimal test successful:", testResult);

        // 5. Generate full predictions
        console.log("\n🎯 Generating full Kolmogorov predictions...");
        const predictions = kolmogorovPredictor.predict(extractedData, 5, { 
            autoCalibrate: true,
            favorHot: true 
        });
        console.log("✅ Predictions generated successfully, count:", predictions.length);

        // 6. Display results
        console.log("\n=== 🎰 KOLMOGOROV-COMPLIANT LOTTERY PREDICTIONS ===");
        predictions.forEach((pred, idx) => {
            console.log(`\n🎲 Prediction ${idx + 1}:`);
            console.log(`  Numbers: ${pred.regular_balls.join(', ')} | Powerball: ${pred.powerball}`);
            console.log(`  Randomness Score: ${pred.randomness_score.toFixed(3)}`);
            console.log(`  Generation Attempts: ${pred.generation_attempts}`);
            if (pred.was_perturbed) console.log(`  ⚡ Perturbed for randomness`);
            if (pred.below_threshold) console.log(`  ⚠️  Below threshold (best available)`);
            if (pred.critical_failure) console.log(`  🚨 Critical pattern detected`);
            if (pred.veto_applied) console.log(`  ⛔ Score capped by veto system`);
        });

        // 7. Detailed randomness analysis
        console.log("\n📊 DETAILED RANDOMNESS ANALYSIS");
        const firstPred = predictions[0];
        console.log(`\n🔍 Analysis of Prediction 1:`);
        console.log(`  📈 Compression Ratio Score: ${firstPred.randomness_details.compressionRatio.toFixed(3)}`);
        console.log(`  🌊 Entropy Score: ${firstPred.randomness_details.entropy.toFixed(3)}`);
        console.log(`  🏃 Runs Test Score: ${firstPred.randomness_details.runsTest.toFixed(3)}`);
        console.log(`  🔗 Serial Correlation Score: ${firstPred.randomness_details.serialCorrelation.toFixed(3)}`);
        console.log(`  📋 Chi-Square Score: ${firstPred.randomness_details.chiSquare.toFixed(3)}`);
        console.log(`  🧬 Lempel-Ziv Complexity: ${firstPred.randomness_details.lempelZiv.toFixed(3)}`);

        // 8. Strategy comparison
        console.log("\n🔄 STRATEGY COMPARISON WITH RANDOMNESS CONSTRAINT");
        const strategies = ['linear', 'exponential', 'logarithmic', 'recency', 'uniform'];

        for (const strategy of strategies) {
            console.log(`\n📐 Testing ${strategy} strategy...`);
            improvedPredictor.setWeightingStrategy(strategy);
            const strategyPredictions = kolmogorovPredictor.predict(extractedData, 3, {
                autoCalibrate: true
            });
            
            const avgRandomness = strategyPredictions.reduce((sum, p) => sum + p.randomness_score, 0) / 3;
            const avgAttempts = strategyPredictions.reduce((sum, p) => sum + p.generation_attempts, 0) / 3;
            
            console.log(`  📊 Average randomness: ${avgRandomness.toFixed(3)}`);
            console.log(`  🔄 Average attempts needed: ${avgAttempts.toFixed(1)}`);
            console.log(`  🎯 Sample: ${strategyPredictions[0].regular_balls.join(', ')} | ${strategyPredictions[0].powerball}`);
        }

        // 9. Threshold impact testing
        console.log("\n🎚️  RANDOMNESS THRESHOLD IMPACT");
        const thresholds = [0.5, 0.7, 0.9];

        for (const threshold of thresholds) {
            console.log(`\n🎯 Testing threshold ${threshold}...`);
            kolmogorovPredictor.setConfig({ randomnessThreshold: threshold });
            const strictPredictions = kolmogorovPredictor.predict(extractedData, 3, {
                autoCalibrate: false
            });
            
            const successRate = strictPredictions.filter(p => !p.below_threshold).length / 3;
            const avgAttempts = strictPredictions.reduce((sum, p) => sum + p.generation_attempts, 0) / 3;
            
            console.log(`  ✅ Success rate: ${(successRate * 100).toFixed(0)}%`);
            console.log(`  🔄 Average attempts: ${avgAttempts.toFixed(1)}`);
        }

        // 10. Historical validation
        console.log("\n📈 HISTORICAL DRAW RANDOMNESS VALIDATION");
        const { KolmogorovLotteryPredictor } = await import('./Kolmogorov.js');
        const validator = new KolmogorovLotteryPredictor();
        
        // Skip the first row if it's malformed (often happens with CSV headers)
        let historicalSample = extractedData.slice(0, 6); // Get 6 to ensure we have 5 good ones
        console.log("🔍 Debug - Sample historical data structure:", historicalSample[0]);
        
        let validDraws = 0;
        for (let idx = 0; idx < historicalSample.length && validDraws < 5; idx++) {
            const draw = historicalSample[idx];
            console.log(`🔍 Debug - Raw draw ${idx + 1}:`, draw);
            
            // Skip if date is not a proper date string
            if (!draw || !Array.isArray(draw) || draw.length < 7 || 
                draw[0] === 'date' || draw[0] === '' || draw[0] === undefined) {
                console.log(`⚠️  Skipping malformed draw ${idx + 1}`);
                continue;
            }
            
            // More robust number extraction
            const numbers = draw.slice(1).map(val => {
                const num = Number(val);
                return isNaN(num) ? 0 : num;
            }).filter(num => num > 0); // Remove invalid numbers
            
            console.log(`🔍 Debug - Parsed numbers for draw ${idx + 1}:`, numbers);
            
            if (numbers.length < 6) {
                console.warn(`⚠️  Insufficient numbers in draw ${idx + 1}: only ${numbers.length} found`);
                continue;
            }
            
            validDraws++;
            const result = validator.calculateRandomnessScore(numbers);
            
            console.log(`\n📅 Historical draw ${validDraws}: ${draw[0]}`);
            console.log(`  🎲 Numbers: ${numbers.slice(0, -1).join(', ')} | ${numbers[numbers.length - 1]}`);
            console.log(`  📊 Overall randomness: ${result.overall.toFixed(3)}`);
            console.log(`  📏 Gap Analysis: ${result.details.gapAnalysis.toFixed(3)}`);
            console.log(`  🔍 Pattern Detection: ${result.details.patternDetection.toFixed(3)}`);
            console.log(`  ${result.overall >= 0.7 ? '✅' : '❌'} Passes default threshold (0.7)`);
            
            if (result.criticalFailure) {
                console.log(`  🚨 Critical pattern detected in historical draw!`);
            }
        }

        // 11. Pattern testing - Now with VETO system
        console.log("\n🔍 NON-RANDOM PATTERN TESTING (With VETO System!)");
        const patternedSequences = [
            { name: "Sequential", seq: [1, 2, 3, 4, 5, 6] },
            { name: "Multiples of 10", seq: [10, 20, 30, 40, 50, 60] }, 
            { name: "Multiples of 7", seq: [7, 14, 21, 28, 35, 42] },   
            { name: "All odd", seq: [1, 3, 5, 7, 9, 11] },
            { name: "Arithmetic +5", seq: [5, 10, 15, 20, 25, 30] },
            { name: "Powers of 2", seq: [2, 4, 8, 16, 32, 64] },
            { name: "Same gaps +4", seq: [3, 7, 11, 15, 19, 23] },
            { name: "Round numbers", seq: [10, 20, 30, 40, 50, 60] }
        ];

        patternedSequences.forEach(({ name, seq }) => {
            const result = validator.calculateRandomnessScore(seq);
            const shouldFail = result.overall < 0.5;
            
            console.log(`\n🔢 ${name} (${seq.join(', ')}):`);
            console.log(`  📊 Overall Score: ${result.overall.toFixed(3)} ${shouldFail ? '❌ FAILS' : '⚠️  PASSES (PROBLEM!)'}`);
            console.log(`  📏 Gap Analysis: ${result.details.gapAnalysis.toFixed(3)}`);
            console.log(`  🔍 Pattern Detection: ${result.details.patternDetection.toFixed(3)}`);
            console.log(`  🔄 Duplicate Analysis: ${result.details.duplicateAnalysis.toFixed(3)}`);
            
            // Show if veto system activated
            if (result.criticalFailure) {
                console.log(`  🚨 CRITICAL PATTERN DETECTED - Veto system activated!`);
            }
            if (result.vetoApplied) {
                console.log(`  ⛔ SCORE CAPPED due to obvious patterns`);
            }
            
            if (!shouldFail) {
                console.log(`  ⚠️  WARNING: This obvious pattern should fail but scored ${result.overall.toFixed(3)}`);
            }
        });

        // Test some legitimately random-looking sequences
        console.log(`\n✅ TESTING LEGITIMATELY RANDOM SEQUENCES:`);
        const randomLookingSequences = [
            { name: "Typical lottery", seq: [7, 23, 41, 52, 63, 18] },
            { name: "Mixed spread", seq: [12, 35, 8, 67, 29, 4] },
            { name: "No obvious pattern", seq: [15, 38, 7, 61, 29, 11] },
            { name: "Good distribution", seq: [3, 19, 31, 48, 65, 12] }
        ];

        randomLookingSequences.forEach(({ name, seq }) => {
            const result = validator.calculateRandomnessScore(seq);
            const passes = result.overall >= 0.5;
            
            console.log(`\n🎲 ${name} (${seq.join(', ')}):`);
            console.log(`  📊 Overall Score: ${result.overall.toFixed(3)} ${passes ? '✅ PASSES' : '❌ FAILS'}`);
            console.log(`  📏 Gap Analysis: ${result.details.gapAnalysis.toFixed(3)}`);
            console.log(`  🔍 Pattern Detection: ${result.details.patternDetection.toFixed(3)}`);
            
            if (result.criticalFailure) {
                console.log(`  ⚠️  Note: Critical failure detected but may still pass overall`);
            }
        });

        // 12. Performance comparison
        console.log("\n⚡ PERFORMANCE COMPARISON");
        
        console.time("Without randomness constraint");
        const normalPredictions = improvedPredictor.predict(extractedData, 100);
        console.timeEnd("Without randomness constraint");

        console.time("With randomness constraint");
        const constrainedPredictions = kolmogorovPredictor.predict(extractedData, 100, {
            autoCalibrate: true
        });
        console.timeEnd("With randomness constraint");

        // Performance statistics
        const totalAttempts = constrainedPredictions.reduce((sum, p) => sum + p.generation_attempts, 0);
        const perturbedCount = constrainedPredictions.filter(p => p.was_perturbed).length;
        const belowThresholdCount = constrainedPredictions.filter(p => p.below_threshold).length;

        console.log(`\n📊 Performance Statistics (100 predictions):`);
        console.log(`  🔄 Total generation attempts: ${totalAttempts}`);
        console.log(`  📈 Average attempts per prediction: ${(totalAttempts / 100).toFixed(1)}`);
        console.log(`  ⚡ Predictions needing perturbation: ${perturbedCount}`);
        console.log(`  ⚠️  Predictions below threshold: ${belowThresholdCount}`);

        // 13. Find most/least random historical draws
        console.log("\n🏆 MOST & LEAST RANDOM HISTORICAL DRAWS");
        
        console.log("🔍 Debug - Processing", extractedData.length, "historical draws...");
        console.log("🔍 Debug - Sample data structure:", extractedData[0]);
        
        const allHistoricalScores = extractedData.map((draw, idx) => {
            // Skip malformed entries
            if (!draw || !Array.isArray(draw) || draw.length < 7 || 
                draw[0] === 'date' || draw[0] === '' || draw[0] === undefined) {
                return null;
            }
            
            // More robust number extraction
            const numbers = draw.slice(1).map(val => {
                const num = Number(val);
                return isNaN(num) ? 0 : num;
            }).filter(num => num > 0);
            
            if (numbers.length < 6) {
                return null;
            }
            
            const result = validator.calculateRandomnessScore(numbers);
            return { 
                date: draw[0], 
                numbers, 
                score: result.overall, 
                index: idx,
                details: result.details,
                criticalFailure: result.criticalFailure,
                vetoApplied: result.vetoApplied
            };
        }).filter(item => item !== null && !isNaN(item.score)); // Remove invalid entries and NaN scores

        if (allHistoricalScores.length === 0) {
            console.error("❌ No valid historical data found for analysis");
            return;
        }

        console.log(`✅ Found ${allHistoricalScores.length} valid historical draws for analysis`);
        allHistoricalScores.sort((a, b) => b.score - a.score);
        
        const mostRandom = allHistoricalScores[0];
        const leastRandom = allHistoricalScores[allHistoricalScores.length - 1];
        
        console.log(`\n🥇 Most random: ${mostRandom.date}`);
        console.log(`  🎲 Numbers: ${mostRandom.numbers.slice(0, -1).join(', ')} | ${mostRandom.numbers[mostRandom.numbers.length - 1]}`);
        console.log(`  📊 Overall Score: ${mostRandom.score.toFixed(3)}`);
        console.log(`  📏 Gap Analysis: ${mostRandom.details.gapAnalysis.toFixed(3)}`);
        console.log(`  🔍 Pattern Detection: ${mostRandom.details.patternDetection.toFixed(3)}`);

        console.log(`\n🥉 Least random: ${leastRandom.date}`);
        console.log(`  🎲 Numbers: ${leastRandom.numbers.slice(0, -1).join(', ')} | ${leastRandom.numbers[leastRandom.numbers.length - 1]}`);
        console.log(`  📊 Overall Score: ${leastRandom.score.toFixed(3)}`);
        console.log(`  📏 Gap Analysis: ${leastRandom.details.gapAnalysis.toFixed(3)}`);
        console.log(`  🔍 Pattern Detection: ${leastRandom.details.patternDetection.toFixed(3)}`);
        
        if (leastRandom.criticalFailure) {
            console.log(`  🚨 Critical pattern detected in least random draw!`);
        }
        if (leastRandom.vetoApplied) {
            console.log(`  ⛔ Score was capped due to obvious patterns`);
        }
        
        // Count draws with critical failures
        const criticalFailureCount = allHistoricalScores.filter(item => item.criticalFailure).length;
        const vetoAppliedCount = allHistoricalScores.filter(item => item.vetoApplied).length;
        
        console.log(`\n🚨 Pattern Detection Summary:`);
        console.log(`  Critical failures detected: ${criticalFailureCount}/${allHistoricalScores.length} (${(criticalFailureCount/allHistoricalScores.length*100).toFixed(1)}%)`);
        console.log(`  Veto system applied: ${vetoAppliedCount}/${allHistoricalScores.length} (${(vetoAppliedCount/allHistoricalScores.length*100).toFixed(1)}%)`);
        
        // Show distribution of scores
        const scoreRanges = {
            'Very Random (0.8-1.0)': 0,
            'Random (0.6-0.8)': 0,
            'Moderate (0.4-0.6)': 0,
            'Poor (0.2-0.4)': 0,
            'Very Poor (0.0-0.2)': 0
        };
        
        allHistoricalScores.forEach(item => {
            const score = item.score;
            if (score >= 0.8) scoreRanges['Very Random (0.8-1.0)']++;
            else if (score >= 0.6) scoreRanges['Random (0.6-0.8)']++;
            else if (score >= 0.4) scoreRanges['Moderate (0.4-0.6)']++;
            else if (score >= 0.2) scoreRanges['Poor (0.2-0.4)']++;
            else scoreRanges['Very Poor (0.0-0.2)']++;
        });
        
        console.log(`\n📊 Historical Randomness Distribution:`);
        Object.entries(scoreRanges).forEach(([range, count]) => {
            const percentage = (count / allHistoricalScores.length * 100).toFixed(1);
            console.log(`  ${range}: ${count} draws (${percentage}%)`);
        });

        console.log("\n🎉 KOLMOGOROV LOTTERY PREDICTOR TEST COMPLETED SUCCESSFULLY!");
        
    } catch (error) {
        console.error("\n❌ ERROR DURING KOLMOGOROV LOTTERY PREDICTOR TEST:");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        throw error;
    }
}

// Run the test
Run()
    .then(() => {
        console.log("\n✅ Test completed successfully!");
        process.exit(0);
    })
    .catch(error => {
        console.error("\n💥 Test failed:", error.message);
        process.exit(1);
    });