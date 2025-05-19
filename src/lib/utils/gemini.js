import { GoogleGenerativeAI } from "@google/generative-ai";
import { SECRET_GOOGLE_KEY } from "$env/static/private";
const apiKey = SECRET_GOOGLE_KEY;
const  genAI = new GoogleGenerativeAI(apiKey);

const systemInstruction =`System Development and Predictive Modeling for CSV-Formatted Data:

You are a supercomputer with advanced analytical capabilities. Develop a sophisticated system to analyze and predict future results from the provided CSV-formatted data. Each record in the dataset contains:

Six Random Numbers: A set of six numbers (2,20,22,26,47, 5) generated from two distinct ranges (1 to 69) for the first 5 numbers and (1 to 26) for the last number.

System Requirements:

-Weighted Historical Statistics: Develop a system that incorporates historical statistics, with a greater weight assigned to the most recent results from the current year. Gradually reduce the weight as the data becomes older.
-Range-Based Filtering: Discount data points with different number ranges than the most recent ones, as these may introduce noise or irregularities in the predictive model.
-Kolmogorov's Theory of Randomness: Utilize Andrey Kolmogorov's theory of randomness to re-roll numbers until they meet the system's criteria, ensuring the generated numbers are truly random and unbiased.
Predictive Modeling and Number Generation:

Using the developed system, generate the next five sets of numbers, applying the following rules:

-Re-roll Numbers: Re-roll numbers using Kolmogorov's theory of randomness until they meet the system's criteria.
-Range Consistency: Ensure that the generated numbers adhere to the same ranges used in the most recent data points.
-Predictive Accuracy: Optimize the system to maximize predictive accuracy, taking into account the weighted historical statistics and range-based filtering.
Deliverables:

-Description of the developed system: Provide a detailed explanation of the system's architecture, including the weighted historical statistics, range-based filtering, and application of Kolmogorov's theory of randomness.
-Generated Numbers: Produce the next five sets of numbers, applying the developed system's rules and criteria. Respond in using the following schema:
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
}`

const config = {
    temperature: 0.2,
    topP: 0.1,
    topK: 16,
    candidateCount: 1,
    maxOutputTokens: 65536, 
    responseMimeType: "application/json",

};
const genModel = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-05-06", 
    generationConfig: config,
    systemInstruction: systemInstruction
});

export async function callGemini(
    prompt
) {
    
    // Helper function to retry with exponential backoff
    const retryWithBackoff = async (operation, maxRetries = 5) => {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error;
          console.error(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
          
          if (attempt === maxRetries) {
            console.error(`All ${maxRetries} attempts failed`);
            throw error;
          }
          
          // Exponential backoff
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw lastError;
    };
    
    return retryWithBackoff(() => genModel.generateContent(prompt, {timeout: 600000}).then(result => result.response.text()));
}