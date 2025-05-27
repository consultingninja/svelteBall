import { improvedPredictor } from './predictorMarkTwo.js';
import { createKolmogorovCompliantPredictor } from './Kolmogorov.js';
import { DataRetriever } from "./dataRetriever.js";
import { extractData } from "../../routes/api/ai/utils.js";

// Sample historical data
// const historicalData = [
//     ["2024-01-01", "5", "12", "23", "45", "67", "15"],
//     ["2024-01-04", "8", "15", "22", "38", "52", "7"],
//     ["2024-01-08", "12", "19", "28", "45", "61", "23"],
//     ["2024-01-11", "3", "17", "29", "44", "66", "11"],
//     ["2024-01-15", "7", "21", "35", "49", "63", "19"],
//     // ... more historical data
// ];


async function Run()
{
const dataRetriever = new DataRetriever('recentData.csv');

// Get or create CSV data
const result = await dataRetriever.getOrCreateData();
const csvData = result.csvData;
// Convert our CSV string into an array of arrays
const extractedData = extractData(csvData);
console.log("Extracted Data:", extractedData);

//Iterate through the csvData and convert from "May 26, 2025","7, 13, 27, 29, 67",8 to our desired format ["2024-01-15", "7", "21", "35", "49", "63", "19"]
console.log("CSV Data retrieved successfully. Processing...");
const processedData = extractedData;



console.log("Processing data for predictions...");

// Create Kolmogorov-compliant predictor
const kolmogorovPredictor = createKolmogorovCompliantPredictor(improvedPredictor);

console.log("=== Kolmogorov-Compliant Lottery Predictions ===\n");

// 1. Generate predictions with auto-calibrated threshold
console.log("1. Auto-calibrated predictions:");
const predictions = kolmogorovPredictor.predict(processedData, 5, { 
    autoCalibrate: true,
    favorHot: true 
});

predictions.forEach((pred, idx) => {
    console.log(`\nPrediction ${idx + 1}:`);
    console.log(`  Numbers: ${pred.regular_balls.join(', ')} | Powerball: ${pred.powerball}`);
    console.log(`  Randomness Score: ${pred.randomness_score.toFixed(3)}`);
    console.log(`  Generation Attempts: ${pred.generation_attempts}`);
    if (pred.was_perturbed) console.log(`  ⚡ Perturbed for randomness`);
    if (pred.below_threshold) console.log(`  ⚠️  Below threshold (best available)`);
});

// 2. Analyze randomness components
console.log("\n2. Detailed randomness analysis of first prediction:");
const firstPred = predictions[0];
console.log(`  Compression Ratio Score: ${firstPred.randomness_details.compressionRatio.toFixed(3)}`);
console.log(`  Entropy Score: ${firstPred.randomness_details.entropy.toFixed(3)}`);
console.log(`  Runs Test Score: ${firstPred.randomness_details.runsTest.toFixed(3)}`);
console.log(`  Serial Correlation Score: ${firstPred.randomness_details.serialCorrelation.toFixed(3)}`);
console.log(`  Chi-Square Score: ${firstPred.randomness_details.chiSquare.toFixed(3)}`);
console.log(`  Lempel-Ziv Complexity: ${firstPred.randomness_details.lempelZiv.toFixed(3)}`);

// 3. Compare different strategies with randomness constraint
console.log("\n3. Strategy comparison with randomness constraint:");
const strategies = ['linear', 'exponential', 'logarithmic', 'recency','uniform'];

strategies.forEach(strategy => {
    improvedPredictor.setWeightingStrategy(strategy);
    const strategyPredictions = kolmogorovPredictor.predict(processedData, 3, {
        autoCalibrate: true
    });
    
    const avgRandomness = strategyPredictions.reduce((sum, p) => sum + p.randomness_score, 0) / 3;
    const avgAttempts = strategyPredictions.reduce((sum, p) => sum + p.generation_attempts, 0) / 3;
    
    console.log(`\n${strategy} strategy:`);
    console.log(`  Average randomness: ${avgRandomness.toFixed(3)}`);
    console.log(`  Average attempts needed: ${avgAttempts.toFixed(1)}`);
    console.log(`  Sample: ${strategyPredictions[0].regular_balls.join(', ')} | ${strategyPredictions[0].powerball}`);
});

// 4. Test with different randomness thresholds
console.log("\n4. Impact of randomness threshold:");
const thresholds = [0.5, 0.7, 0.9];

thresholds.forEach(threshold => {
    kolmogorovPredictor.setConfig({ randomnessThreshold: threshold });
    const strictPredictions = kolmogorovPredictor.predict(processedData, 3, {
        autoCalibrate: false
    });
    
    const successRate = strictPredictions.filter(p => !p.below_threshold).length / 3;
    const avgAttempts = strictPredictions.reduce((sum, p) => sum + p.generation_attempts, 0) / 3;
    
    console.log(`\nThreshold ${threshold}:`);
    console.log(`  Success rate: ${(successRate * 100).toFixed(0)}%`);
    console.log(`  Average attempts: ${avgAttempts.toFixed(1)}`);
});

// 5. Validate that historical draws pass randomness tests
console.log("\n5. Historical draw randomness validation:");
const historicalRandomness = processedData.slice(0, 5).map(draw => {
    const numbers = draw.slice(1).map(Number);
    const predictor = new ( import('./kolmogorovLotteryPredictor.js')).KolmogorovLotteryPredictor();
    return predictor.calculateRandomnessScore(numbers);
});

historicalRandomness.forEach((score, idx) => {
    console.log(`\nHistorical draw ${idx + 1}: ${processedData[idx][0]}`);
    console.log(`  Overall randomness: ${score.overall.toFixed(3)}`);
    console.log(`  Passes default threshold (0.7): ${score.overall >= 0.7 ? '✓' : '✗'}`);
});

// 6. Extreme case: What happens with non-random patterns?
console.log("\n6. Testing non-random patterns:");
const patternedSequences = [
    [1, 2, 3, 4, 5, 6],           // Sequential
    [10, 20, 30, 40, 50, 10],     // Multiples of 10
    [7, 7, 14, 21, 28, 7],        // Multiples of 7 with repetition
    [1, 3, 5, 7, 9, 11],          // All odd numbers
];

const predictor = new (await import('./kolmogorovLotteryPredictor.js')).KolmogorovLotteryPredictor();
patternedSequences.forEach((seq, idx) => {
    const score = predictor.calculateRandomnessScore(seq);
    console.log(`\nPattern ${idx + 1} (${seq.join(', ')}): ${score.overall.toFixed(3)}`);
});

// 7. Performance impact of randomness constraint
console.log("\n7. Performance comparison:");
console.time("Without randomness constraint");
const normalPredictions = improvedPredictor.predict(processedData, 100);
console.timeEnd("Without randomness constraint");

console.time("With randomness constraint");
const constrainedPredictions = kolmogorovPredictor.predict(processedData, 100, {
    autoCalibrate: true
});
console.timeEnd("With randomness constraint");

// Calculate statistics
const totalAttempts = constrainedPredictions.reduce((sum, p) => sum + p.generation_attempts, 0);
const perturbedCount = constrainedPredictions.filter(p => p.was_perturbed).length;
const belowThresholdCount = constrainedPredictions.filter(p => p.below_threshold).length;

console.log(`\nStatistics for 100 predictions:`);
console.log(`  Total generation attempts: ${totalAttempts}`);
console.log(`  Average attempts per prediction: ${(totalAttempts / 100).toFixed(1)}`);
console.log(`  Predictions that needed perturbation: ${perturbedCount}`);
console.log(`  Predictions below threshold: ${belowThresholdCount}`);

// 8. Find the "most random" historical draw
console.log("\n8. Most and least random historical draws:");
const allHistoricalScores = processedData.map((draw, idx) => {
    const numbers = draw.slice(1).map(Number);
    const score = predictor.calculateRandomnessScore(numbers);
    return { date: draw[0], numbers, score: score.overall, index: idx };
});

allHistoricalScores.sort((a, b) => b.score - a.score);
console.log(`\nMost random: ${allHistoricalScores[0].date}`);
console.log(`  Numbers: ${allHistoricalScores[0].numbers.join(', ')}`);
console.log(`  Score: ${allHistoricalScores[0].score.toFixed(3)}`);

console.log(`\nLeast random: ${allHistoricalScores[allHistoricalScores.length - 1].date}`);
console.log(`  Numbers: ${allHistoricalScores[allHistoricalScores.length - 1].numbers.join(', ')}`);
console.log(`  Score: ${allHistoricalScores[allHistoricalScores.length - 1].score.toFixed(3)}`);
}


Run().then(() => {
    console.log("Kolmogorov Lottery Predictor Test Completed Successfully!");
}
).catch(error => {
    console.error("Error during Kolmogorov Lottery Predictor Test:", error);
});