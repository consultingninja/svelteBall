import  puppeteer  from "puppeteer";
import fs from "fs/promises";
import {parse} from 'csv-parse'
import {SECRET_AIBALL_KEY} from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';

const haiku = 'claude-3-haiku-20240307';
const sonnet = 'claude-3-5-sonnet-20241022';
const opus = 'claude-3-opus-20240229';

// Define a function to read the last date from a CSV file containing data
async function getOrderLastDate(csvData) {
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

function convertToCSV(data) {
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



async function puppetScrape(startDate) {
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
 let year = startDate ? startDate.getFullYear() : 1992;

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

async function getAnthropicCompletion(csvData){
  console.log("Initializing completion request... ");

  try{
    const anthropic = new Anthropic({
      apiKey: SECRET_AIBALL_KEY, // This is the default and can be omitted
    });
  
    const message = await anthropic.messages.create({
      max_tokens: 4096,
      system: `System Development and Predictive Modeling for CSV-Formatted Data

As a supercomputer with advanced analytical capabilities, I will develop a sophisticated system to analyze and predict future results from the provided CSV-formatted data. Each record in the dataset contains:

Date: The date the data was created (format: "April 24, 2024")
Supposedly Random Numbers: A set of five numbers (2,20,22,26,47) generated from two distinct ranges
Ranges: The lower and upper bounds used to generate the numbers (e.g., 1 to 69 for the first five numbers and 1 to 26 for the last number)
System Requirements:

Weighted Historical Statistics: Develop a system that incorporates historical statistics, with a greater weight assigned to the most recent results from the current year. Gradually reduce the weight as the data becomes older.
Range-Based Filtering: Discount data points with different number ranges than the most recent ones, as these may introduce noise or irregularities in the predictive model.
Kolmogorov's Theory of Randomness: Utilize Andrey Kolmogorov's theory of randomness to re-roll numbers until they meet the system's criteria, ensuring the generated numbers are truly random and unbiased.
Predictive Modeling and Number Generation:

Using the developed system, generate the next five sets of numbers, applying the following rules:

Re-roll Numbers: Re-roll numbers using Kolmogorov's theory of randomness until they meet the system's criteria.
Range Consistency: Ensure that the generated numbers adhere to the same ranges used in the most recent data points.
Predictive Accuracy: Optimize the system to maximize predictive accuracy, taking into account the weighted historical statistics and range-based filtering.
Deliverables:

Description of the developed system: Provide a detailed explanation of the system's architecture, including the weighted historical statistics, range-based filtering, and application of Kolmogorov's theory of randomness.
Generated Numbers: Produce the next five sets of numbers, applying the developed system's rules and criteria. Respond in using the following schema:
      {
  "type": "object",
  "properties": {
    "explanation": {
      "type": "string",
      "description": "The reasoning behind the generation of the sets of numbers."
    },
    "sets": {
      "type": "array",
      "description": "An array of objects, each representing a set of numbers.",
      "items": {
        "type": "object",
        "properties": {
          "regularBalls": {
            "type": "array",
            "description": "An array of 5 unique numbers representing the regular balls.",
            "items": {
              "type": "integer",
              "minimum": 1,
              "maximum": 69
            },
            "minItems": 5,
            "maxItems": 5,
            "uniqueItems": true
          },
          "powerball": {
            "type": "integer",
            "description": "A single number representing the Powerball.",
            "minimum": 1,
            "maximum": 26
          }
        },
        "required": ["regularBalls", "powerball"],
        "additionalProperties": false
      }
    }
  },
  "required": ["explanation", "sets"],
  "additionalProperties": false
}
` ,
      messages: [{ role: 'user', content: `<datatoanalyze> <${csvData}> </datatoanalyze>` }],
      model: sonnet,
      temperature: 0,

    });
  
    console.log(message.content);
  
    return new Response(JSON.stringify(message.content[0]), { status: 200 });
  }
  catch(e){
    console.log("Anthropic Error: ", e);
    return Error("Anthropic Error: ", e);
  }


}

// async function getAnthropicCompletion(csvData){
//   console.log("Initializing completion request... ");

//   try{
//     const anthropic = new Anthropic({
//       apiKey: SECRET_AIBALL_KEY, // This is the default and can be omitted
//     });
  
//     const message = await anthropic.messages.create({
//       max_tokens: 4096,
//       system: `You are a super llm that can analyze anything.  You find even the slightest patterns in data.  Capable of predicting future results using mathematics and analysis. You will be given a giant list of csv formatted information.  Take the information and for each record give back the results and also for each number calculate what an llm would predice the next number to be in the sequence.  Be sure to update your calculation for every record and every number. `,
//       messages: [{ role: 'user', content: `<datatoanalyze> <${csvData}> </datatoanalyze>` }],
//       model: haiku,
//     });
  
//     console.log(message.content);
  
//     return new Response(JSON.stringify(message.content[0]), { status: 200 });
//   }
//   catch(e){
//     console.log("Anthropic Error: ", e);
//     return Error("Anthropic Error: ", e);
//   }


// }

async function getPhi3Completion(csvData){
  console.log("Initializing PHI3 completion request... ");

  try{

    const response = await fetch( 'http://127.0.0.1:11434/api/generate',
    {
      method: 'POST',
      body: JSON.stringify({
      "model": 'phi3',
      stream:false,
      prompt: `You are a super computer.  You find even the slightest patterns in data.  Capable of predicting future results using mathematics and analysis.  Analyze the given csv-formatted data. Each record looks like this: "April 24, 2024","2,20,22,26,47",21,1 to 69,1 to 26, The record contains the following information: Date the data was created, Then 6 supposedly random numbers from a range (one range used for the first 5, and one range used for the last number), the last two pieces of each line of the csv are the ranges used when creating the supposedly random numbers.  The first range is what was used for the first 5 numbers, the second range is the one used for the last number.   Read and analyze the data. Then using any patterns you find try your best to guess the next 6 numbers using the most recentle used ranges for first 5 and last 1 respectively. Give your predicted numbers in JSON format with the keys "regularBalls" (an array of 5 numbers) and "powerball" (a single number). i.e. {"regularBalls":[7,15,24,45,68],"powerball":24} ${csvData}` ,
    })

    });

    const data = await response.json();
  
    console.log(data.response);
  
    return new Response(JSON.stringify(data.response), { status: 200 });
  }
  catch(e){
    console.log("Phi3 Error: ", e);
    return Error("Phi3 Error: ", e);
  }


}



export async function GET(){

try{
  console.log("Reading csv file...");
  //open csv file and read it
  const csvData = await fs.readFile('data.csv', 'utf8');

  //if the file exists but is empty throw an error so we can replace it with new data
  if(csvData.length === 0){
    throw new Error("Empty file");
  }

  try{
    console.log("Ordering data and finding last file date...");
    //order the csv data by date and return the last date
    const sortedResults = await getOrderLastDate(csvData);
    //get the last date
    const startDate = new Date(sortedResults.lastDate)
    console.log("Starting updating scrape from: ", startDate);
    //initialize a new scrape from the last date, this will potentially return overlapping data
    const updateScrapedData = await puppetScrape(startDate);
    //count the number of entries in the new data
    const numberOfEntries = updateScrapedData.length;

    if(numberOfEntries > 0){
      console.log(`${numberOfEntries} new entries found adding to file... `, updateScrapedData)
      //convert the new data to a csv string
      const csvString = convertToCSV(updateScrapedData);
      //order the new data by date
      const sortedUpdateResults = await getOrderLastDate(csvString);
      //add the new csv data to the end of the old csv data
      const updatedCsvData = sortedResults.parsedData.concat(sortedUpdateResults.parsedData);
      //convert the updated records back into a csv string
      const csvStringUpdated = convertToCSV(updatedCsvData);
      //write the updated data back to the file
      await fs.writeFile('data.csv', csvStringUpdated);
      console.log("Data file updated... ");
      return await getAnthropicCompletion(csvStringUpdated); //**uncomment this line to use the Anthropic AI model
      //return await getPhi3Completion(csvStringUpdated);
    }
    else{
      console.log("No new entries found in the scrape...");
      //convert orginal data back to csv string after ordering
      const unUpdatedCsvString = convertToCSV(sortedResults.parsedData);

      return await getAnthropicCompletion(unUpdatedCsvString); //**uncomment this line to use the Anthropic AI model
      //return await getPhi3Completion(unUpdatedCsvString);
    }

    //continue to the next step
  
  }
  catch(e){ 
    console.log("Error parsing csv data: ", e);
    return new Response("Error parsing data or generating response: ", { status: 500 });
  }


}
catch(e){
  console.log("Error reading csv file: \n");
  try {
    console.log("Initializing new scrape...\n");
    //initialize a new scrape to create a new file
    const scrapedData = await puppetScrape();
    console.log("Converting to csv ");
    const csvString = convertToCSV(scrapedData);
    console.log("Data converted writing to file... ");
    //write csv string to a file
    await fs.writeFile('data.csv', csvString);
    console.log("Data written to file... ");
    console.log("Parsing and ordering csv data...");
    //order the csv data by date
    const sortedResults = await getOrderLastDate(csvString);
    console.log("Last line: ", sortedResults.lastDate);
    if(sortedResults.changed){
      const csvStringSorted = convertToCSV(sortedResults.parsedData);
      //write the sorted data back to the file
      await fs.writeFile('data.csv', csvStringSorted);
      return await getAnthropicCompletion(csvStringSorted); //**uncomment this line to use the Anthropic AI model
      // return await getPhi3Completion(csvStringSorted);
    }

    console.log("Getting Anthropic completion...");
    return await getAnthropicCompletion(csvString); //**uncomment this line to use the Anthropic AI model
    // console.log("Getting Phi3 completion...");
    // return await getPhi3Completion(csvStringSorted);
  } catch (error) {
    console.log("Error:", error);
    return new Response("Error parsing data or generating response: ", { status: 500 });
  }

}

}



// async function puppetScrape(startDate) {
//   //make a date variable that is today in the following format: "April 22, 1992"
//   const today = new Date();

//   const ruleSets = [
//       { dateRange: { start: new Date("April 22, 1992"), end: new Date("January 15, 2012") }, mainNumberPool: "1 to 45", powerballPool: "1 to 45" },
//       { dateRange: { start: new Date("January 15, 2012"), end: new Date("October 7, 2015") }, mainNumberPool: "1 to 59", powerballPool: "1 to 35" },
//       { dateRange: { start: new Date("October 7, 2015"), end: today }, mainNumberPool: "1 to 69", powerballPool: "1 to 26" }
//   ];

//   const data = [];
//   let year = startDate? startDate : 1992;

//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();

//   while (year <= 2024) {
//     console.log("Scraping data for year: ", year);
//       const currentReq = `https://www.powerball.net/archive/${year}`;
//       await page.goto(currentReq);

//       const dates = await page.$$('.archive-box');

//       for (const date of dates) {
//           let dateText = await date.evaluate(node => node.innerText.trim());
//           dateText = dateText.split('\n')[0]; // Extracting only the date portion
//           const regularBalls = await date.$$eval('.balls > .ball', balls => balls.map(ball => parseInt(ball.textContent)));
//           const powerBall = await date.$eval('.balls > .powerball', ball => parseInt(ball.textContent));

//           // Find the rule set that applies to this date
//           const ruleSet = ruleSets.find(rule => {
//               const currentDate = new Date(dateText);
//               return currentDate >= rule.dateRange.start && currentDate < rule.dateRange.end;
//           });
//           console.log("Rule set: ", JSON.stringify({
//             date: dateText,
//             regularBalls: regularBalls,
//             powerball: powerBall,
//             mainNumberPool: ruleSet.mainNumberPool,
//             powerballPool: ruleSet.powerballPool
//         }));

//           data.push({
//               date: dateText,
//               regularBalls: regularBalls,
//               powerball: powerBall,
//               mainNumberPool: ruleSet.mainNumberPool,
//               powerballPool: ruleSet.powerballPool
//           });
//       }


//       year++;
      
//   }

//   await browser.close();

//   console.log('Data scraped successfully')
//   return data;
// }