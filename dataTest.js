import { DataRetriever } from "./src/lib/utils/dataRetriever.js";
import { improvedPredictor } from "./src/lib/utils/predictorMarkTwo.js";
import { extractData } from "./src/lib/utils/common.js";

const dataRetriever = new DataRetriever();
async function run() {
  try {
    // Check if file exists and has content
    const data = await dataRetriever.getOrCreateData();
    if (!data || !data.csvData) {
      throw new Error("No data available for scraping");
    }
    // Extract relevant data using the new utility function
    const extractedData = extractData(data.csvData);
    console.log("Extracted Data:", extractedData);

    // create a new instance of the improved predictor
    const predictor = improvedPredictor(extractedData);
    console.log("Predictions:", predictions);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// async function run() {
//     try{
//         const results = await puppetScrape();
//         console.log("Scraped Data:", results);
//     }
//     catch (error) {
//         console.error("Error during scraping:", error.message);
//     }
// }


run().catch(console.error);