import puppeteer from 'puppeteer';
import { parse } from 'csv-parse';

// Function to extract data from CSV formatted as "date,secondValue,thirdValue"
export function extractData(csvData) {
    const lines = csvData.trim().split('\n');
    const results = [];
  
    for (const line of lines) {
      // Use a regular expression to split the line by commas, but handle quoted strings
      const values = line.match(/(?:"([^"]*?)"|([^,]*))(?:,|$)/g).map(match => {
        return match.replace(/,"?$/, '').replace(/^"?,/, '');
      });
  
      if (values.length >= 3) {
        const dateValue = values[0].replace(/"/g, ''); // First quoted value (date) with quotes removed
        const secondValue = values[1]; // Second quoted value
        const thirdValue = values[2];  // Third unquoted value
  
        // Split the second value by commas and convert to numbers if needed
        const secondValueArray = secondValue.split(',').map(item => item.trim());
  
        // Remove quotes from the first and fifth values
        if (secondValueArray.length > 0) {
          secondValueArray[0] = secondValueArray[0].replace(/"/g, '');
        }
        if (secondValueArray.length > 4) {
          secondValueArray[4] = secondValueArray[4].replace(/"/g, '');
        }
  
        // Include the date as the first element of the result array
        results.push([dateValue, ...secondValueArray, thirdValue]);
      }
    }
    return results;
  }



// Define a function to read the last date from a CSV file containing data
export async function getOrderLastDate(csvData) {
  const parsedData = await new Promise((resolve, reject) => {
    parse(csvData, { columns: true }, (err, output) => {
      if (err) reject(err);
      else {
        output.forEach(row => {
          if (row.regularBalls) {
            row.regularBalls = row.regularBalls.split(',').map(Number);
          }
        });
        resolve(output);
      }
    });
  });

  // Keep a copy of the original data
  const originalData = [...parsedData];

  // Sort the data chronologically based on the date
  parsedData.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
  });

  // Check if the order has changed
  const changed = JSON.stringify(originalData) !== JSON.stringify(parsedData);

  // Return the last date
  const lastDate = parsedData[parsedData.length - 1].date;
  return { lastDate, parsedData, changed };
}

export function convertToCSV(data) {
  function escapeCSVField(field) {
    if (typeof field === 'string' && field.includes(',')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }

  const headers = Object.keys(data[0]);

  const csvLines = data.map(obj => {
    return headers.map(header => {
      let value = obj[header];
      if (header === 'regularBalls' && Array.isArray(value)) {
        value = value.join(',');
      }
      return escapeCSVField(value);
    }).join(',');
  });

  const headerLine = headers.join(',');
  return headerLine + '\n' + csvLines.join('\n');
}



export async function puppetScrape(startDate) {
 //make a date variable that is today in the following format: "April 22, 1992"
 const today = new Date();

 //pull out year from the date variable
 const todaysYear = today.getFullYear();

 const ruleSets = [
     { dateRange: { start: new Date("April 22, 1992"), end: new Date("January 15, 2012") }, mainNumberPool: "1 to 45", powerballPool: "1 to 45" },
     { dateRange: { start: new Date("January 15, 2012"), end: new Date("October 7, 2015") }, mainNumberPool: "1 to 59", powerballPool: "1 to 35" },
     { dateRange: { start: new Date("October 7, 2015"), end: today }, mainNumberPool: "1 to 69", powerballPool: "1 to 26" }
 ];

 const data = [];
 let year = startDate ? startDate.getFullYear() : 2014;

 const browser = await puppeteer.launch();
 const page = await browser.newPage();

 while (year <= todaysYear) {
     console.log("Scraping data for year: ", year);
     const currentReq = `https://www.powerball.net/archive/${year}`;
     await page.goto(currentReq);

     const dates = await page.$$('.archive-box');

     for (const date of dates) {
         let dateText = await date.evaluate(node => node.innerText.trim());
         dateText = dateText.split('\n')[0]; // Extracting only the date portion
         //if we are doing an updated scrape we need to check for start date and be sure to exclude if the date matches
          if(startDate && new Date(dateText) <= startDate){
            console.log("Skipping already scraped date: ", dateText);
            continue;
          }
         const ballsContainer = await date.$$('.balls');
         const regularBalls = await ballsContainer[0].$$eval('.ball', balls => balls.map(ball => parseInt(ball.textContent)));
         const powerBall = await ballsContainer[0].$eval('.powerball', ball => parseInt(ball.textContent));
         let doublePlayResult = null;

         if (ballsContainer.length > 1) {
             const doublePlayRegularBalls = await ballsContainer[1].$$eval('.ball', balls => balls.map(ball => parseInt(ball.textContent)));
             const doublePlayPowerBall = await ballsContainer[1].$eval('.powerball', ball => parseInt(ball.textContent));

             doublePlayResult = {
                date: dateText,
                regularBalls: doublePlayRegularBalls,
                powerball: doublePlayPowerBall,
             };
         }

         // Find the rule set that applies to this date
         const ruleSet = ruleSets.find(rule => {
             const currentDate = new Date(dateText);
             return currentDate >= rule.dateRange.start && currentDate < rule.dateRange.end;
         });

         console.log("Rule set: ", JSON.stringify({
             date: dateText,
             regularBalls: regularBalls,
             powerball: powerBall,
             mainNumberPool: ruleSet.mainNumberPool,
             powerballPool: ruleSet.powerballPool,
         }));

         data.push({
             date: dateText,
             regularBalls: regularBalls,
             powerball: powerBall,
             mainNumberPool: ruleSet.mainNumberPool,
             powerballPool: ruleSet.powerballPool,
         });
         if (doublePlayResult) {
             data.push({...doublePlayResult, mainNumberPool: ruleSet.mainNumberPool, powerballPool: ruleSet.powerballPool});
         }
     }

     year++;

 }

 await browser.close();

 console.log('Data scraped successfully');
 //sort the data by date
  data.sort((a, b) => new Date(a.date) - new Date(b.date));
 return data;
}