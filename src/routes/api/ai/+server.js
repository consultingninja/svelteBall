

import { extractData } from "./utils.js";
import { sweetSpotPredictor } from "../../../lib/utils/SweetSpot.js";
import { DataRetriever } from "../../../lib/utils/dataRetriever.js";
import { ImprovedLotteryPredictor } from "../../../lib/utils/predictorMarkTwo.js";
import { KolmogorovLotteryPredictor, createKolmogorovCompliantPredictor } from "../../../lib/utils/Kolmogorov.js";
import { generateCompliantSets } from "../../../lib/utils/noVetoGenerator.js";

export async function GET() {
  try {
    const dataRetriever = new DataRetriever('data.csv');
    
    // Get or create CSV data
    const result = await dataRetriever.getOrCreateData();
    const csvData = result.csvData;
    
    console.log("Processing data for predictions...");
    
    // Extract and filter data
    const extractedData = extractData(csvData);
    const filteredData = extractedData.filter(arr => arr.length >= 6);
    
    if (filteredData.length === 0) {
      console.warn("No valid data found for predictions");
      return new Response(
        JSON.stringify({ error: "Insufficient data for predictions" }), 
        { status: 400 }
      );
    }
    
    // Generate predictions
    const numberOfSets = 5; // Define how many sets you want to generate
    const predictions = generateCompliantSets(numberOfSets,filteredData);
    console.log("Generated predictions:", predictions);
    
    return new Response(JSON.stringify(predictions), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error("Error in GET handler:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate predictions",
        message: error.message 
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}


