import fs from 'fs/promises';
import { getOrderLastDate, puppetScrape, convertToCSV } from './common.js';

export class DataRetriever {
  constructor(filePath = 'recentData.csv') {
    this.filePath = filePath;
  }

  /**
   * Check if the CSV file exists and has content
   */
  async fileExists() {
    try {
      const stats = await fs.stat(this.filePath);
      return stats.size > 0; // Ensures file is not empty
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // File does not exist
      }
      throw error; // Other errors (e.g., permissions)
    }
  }

  /**
   * Read CSV file. Throws an error if the file is empty or not found.
   */
  async readCsvFile() {
    try {
      const csvData = await fs.readFile(this.filePath, 'utf8');
      
      // Note: fileExists() already checks for stats.size > 0.
      // This check is an additional safeguard or if fileExists isn't used before calling.
      if (csvData.trim().length === 0) { 
        throw new Error("CSV file is empty or contains only whitespace");
      }
      
      return csvData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // This case should ideally be caught by a prior fileExists() check,
        // but it's good to handle it here too.
        throw new Error(`CSV file not found: ${this.filePath}`);
      }
      // Re-throw other read errors or the "CSV file is empty" error
      throw error;
    }
  }

  /**
   * Write CSV data to file
   */
  async writeCsvFile(csvData) {
    try {
      await fs.writeFile(this.filePath, csvData);
      console.log(`Data written to ${this.filePath}`);
    } catch (error) {
      console.error(`Error writing to ${this.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Filter and format scraped data from an array of objects
   * @param {Array} data - Array of objects containing raw scraped lottery data
   * @returns {Array} - Array of formatted objects
   */
  formatData(data) {
    if (!data || !Array.isArray(data)) {
      return [];
    }
    return data.map(item => ({
      date: item.date,
      regularballs: item.regularBalls && Array.isArray(item.regularBalls) ? item.regularBalls.join(', ') : '',
      powerball: item.powerball // convertToCSV will handle converting this to a string
    }));
  }

  /**
   * Initialize fresh data by scraping all available entries, formatting,
   * sorting, and creating/overwriting the CSV file.
   * This method is typically called when the data file does not exist or is found to be empty/invalid.
   * @returns {Promise<string>} The CSV string of the newly initialized and sorted data.
   */
  async initializeData() {
    console.log(`Initializing data for ${this.filePath}: Scraping all available entries.`);
    const rawScrapedData = await puppetScrape(); // Scrape all data (no date parameter)

    if (!rawScrapedData || rawScrapedData.length === 0) {
      console.log("Initial scrape returned no data. Writing empty/header-only CSV.");
      const emptyCsv = convertToCSV([]); // convertToCSV should handle an empty array (e.g., write only headers)
      await this.writeCsvFile(emptyCsv);
      return emptyCsv;
    }

    console.log(`Scraped ${rawScrapedData.length} initial entries.`);
    const formattedData = this.formatData(rawScrapedData);
    console.log("Initial data formatted.");

    // To sort the data consistently, convert to a temporary CSV string,
    // then use getOrderLastDate which is responsible for parsing and sorting.
    const tempCsvForSorting = convertToCSV(formattedData);
    const orderResult = await getOrderLastDate(tempCsvForSorting);
    // orderResult.parsedData contains the sorted array of objects.
    
    const finalSortedCsv = convertToCSV(orderResult.parsedData);
    await this.writeCsvFile(finalSortedCsv);
    console.log("Initialized, formatted, and sorted data written to file.");
    return finalSortedCsv;
  }


  /**
   * Get or create CSV data - main entry point.
   * Reads the file if it exists, fetches the most recent date, scrapes new data,
   * appends new unique entries, ensures data is sorted, and writes back to the file.
   * If the file doesn't exist or is empty, it initializes it.
   * @returns {Promise<{updated: boolean, csvData: string}>} 
   *          - updated: true if the file was created or modified, false otherwise.
   *          - csvData: The final CSV content as a string.
   */
  async getOrCreateData() {
    try {
      let existingCsvString = null;
      let existingDataObjects = []; // Will hold sorted data objects from the file
      let mostRecentDateFromFile = undefined;
      let initialSortActionTookPlace = false; // Flag if getOrderLastDate re-sorted the existing file

      if (await this.fileExists()) {
        console.log(`File '${this.filePath}' exists. Reading and processing...`);
        try {
          existingCsvString = await this.readCsvFile(); // Throws if empty based on its own logic
          
          // Use getOrderLastDate to parse, sort, and get the last date from existing CSV
          const orderResult = await getOrderLastDate(existingCsvString);
          existingDataObjects = orderResult.parsedData; // These are sorted objects
          mostRecentDateFromFile = orderResult.lastDate;
          initialSortActionTookPlace = orderResult.changed;

          if (existingDataObjects.length === 0) {
            // File existed but was effectively empty (e.g., only header, or unparseable content by getOrderLastDate)
            console.log(`Existing file '${this.filePath}' is empty or contains no valid data. Initializing...`);
            // Fall through to initialization by letting existingDataObjects remain empty
          } else {
            console.log(`Processed existing file: ${existingDataObjects.length} entries. Most recent date: ${mostRecentDateFromFile || 'N/A'}. Initial sort changed file: ${initialSortActionTookPlace}.`);
          }
        } catch (error) {
          // Catch errors from readCsvFile (e.g. "CSV file is empty") or getOrderLastDate
          console.warn(`Error processing existing file '${this.filePath}', will initialize from scratch: ${error.message}`);
          existingDataObjects = []; // Ensure initialization path is taken
          existingCsvString = null; // No valid existing string
        }
      } else {
        // File does not exist
        console.log(`File '${this.filePath}' not found. Initializing new data...`);
        // existingDataObjects is already empty, so initialization path will be taken
      }

      // If no data could be loaded from an existing file (it didn't exist, was effectively empty, or error during processing)
      if (existingDataObjects.length === 0) {
        const newCsvData = await this.initializeData(); // This creates/overwrites the file with new, sorted data
        return { updated: true, csvData: newCsvData }; // Initialization always implies an update
      }

      // ---- At this point, file existed and contained processable data ----
      console.log(`Scraping for new data entries for '${this.filePath}' since: ${mostRecentDateFromFile || 'the beginning (no valid last date found)'}.`);
      const newRawData = await puppetScrape(mostRecentDateFromFile);

      let newUniqueItemsAdded = false;
      // Start with current sorted data; new items will be added and then the whole list re-sorted if needed.
      let combinedDataObjects = [...existingDataObjects]; 

      if (newRawData && newRawData.length > 0) {
        console.log(`Scraped ${newRawData.length} new raw entries.`);
        const newFormattedData = this.formatData(newRawData);

        // Create a Set of existing dates for quick de-duplication lookup
        const existingEntryKeys = new Set(combinedDataObjects.map(item => item.date));
        
        for (const newItem of newFormattedData) {
          if (!existingEntryKeys.has(newItem.date)) { // Check for duplicates based on date
            combinedDataObjects.push(newItem);
            existingEntryKeys.add(newItem.date); // Add to set in case new data has internal duplicates
            newUniqueItemsAdded = true;
          }
        }

        if (newUniqueItemsAdded) {
          console.log("New unique items were identified and added to the collection.");
        } else {
          console.log("Scraped data contained only duplicates of existing entries or was empty after formatting.");
        }
      } else {
        console.log("No new raw data found from scrape.");
      }

      // An update to the file is needed if:
      // 1. The initial read and sort of the existing file resulted in changes (initialSortActionTookPlace = true)
      // OR
      // 2. New unique items were actually added from the scrape (newUniqueItemsAdded = true)
      if (initialSortActionTookPlace || newUniqueItemsAdded) {
        console.log("Data has changed (due to initial sort or new items). Re-sorting combined data and writing to file.");
        
        // combinedDataObjects now contains the original sorted items + any new unique items (appended).
        // This full list needs to be sorted to ensure overall oldest-to-newest order.
        const tempCsvForFinalSort = convertToCSV(combinedDataObjects);
        const finalOrderResult = await getOrderLastDate(tempCsvForFinalSort); // Use getOrderLastDate for consistent sorting
        const finalCsvOutput = convertToCSV(finalOrderResult.parsedData);
        
        await this.writeCsvFile(finalCsvOutput);
        return { updated: true, csvData: finalCsvOutput };
      } else {
        // No new items were added, and the existing file was already sorted correctly.
        console.log(`No changes to data for '${this.filePath}'. File is current.`);
        return { updated: false, csvData: existingCsvString }; // Return the original CSV string as read from file
      }

    } catch (error) {
      console.error(`Critical error in getOrCreateData for file '${this.filePath}':`, error);
      // Depending on application needs, you might want to:
      // - Rethrow the error to be handled by the caller.
      // - Return a specific error state, e.g., { updated: false, csvData: null, error: error.message }
      // For now, rethrowing to indicate a failure in the process.
      throw error;
    }
  }
}