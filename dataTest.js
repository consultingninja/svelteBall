import { DataRetriever } from "./src/lib/utils/dataRetrieverGemini.js";
import { puppetScrape } from "./src/lib/utils/common.js";

const dataRetriever = new DataRetriever();
async function run() {
  try {
    // Check if file exists and has content
    const exists = await dataRetriever.fileExists();
    console.log(`File exists: ${exists}`);

    if (!exists) {
      console.log("File does not exist or is empty. Initializing fresh data...");
      await dataRetriever.initializeData();
    } else {
      console.log("Reading existing CSV file...");
      const csvData = await dataRetriever.readCsvFile();
      console.log("CSV Data:", csvData);
    }
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