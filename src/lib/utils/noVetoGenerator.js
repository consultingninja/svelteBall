import { ImprovedLotteryPredictor } from './predictorMarkTwo.js';
import { PatternVettingPredictor } from './patternPredictor.js';

export function generateCompliantSets(numberOfSets,historicalData) {
  const generator = new ImprovedLotteryPredictor();
  const vet = new PatternVettingPredictor();
  const finalSets = [];
  let attempts = 0;
  const MAX_ATTEMPTS = 10000; // Safety break

  while (finalSets.length < numberOfSets && attempts < MAX_ATTEMPTS) {
    // 1. Generate a candidate set using historical weights
    const candidate = generator.predict(historicalData, 1);

    // 2. Vet the candidate against our rules
    const vetoResult = vet.vet(candidate[0]);

    // 3. If it passes (is not vetoed), add it to our list
    if (!vetoResult.isVetoed) {
      finalSets.push(candidate);
    } else {
      // Optional: Log why it was rejected
      console.log(`Set ${candidate} rejected because: ${vetoResult.reason}`);
    }
    attempts++;
  }
  return finalSets.flat();
}