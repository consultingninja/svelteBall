

import { extractData } from "$lib/utils/utils.js";
import { DataRetriever } from "$lib/utils/dataRetriever.js";

import { generateCompliantSets } from "$lib/utils/noVetoGenerator.js";

export async function GetSets(){
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
        return [];
    }
    
    // Generate predictions
    const numberOfSets = 5; // Define how many sets you want to generate
    const predictions = generateCompliantSets(numberOfSets,filteredData);
    console.log("Generated predictions:", predictions);

    return predictions;

    } catch (error) {
        console.error("Error in GetSets:", error);
        return [];
    }
}




