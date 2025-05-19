// export function extractData(csvData) {
//     const lines = csvData.trim().split('\n');
//     const results = [];
  
//     for (const line of lines) {
//       // Use a regular expression to split the line by commas, but handle quoted strings
//       const values = line.match(/(?:"([^"]*?)"|([^,]*))(?:,|$)/g).map(match => {
//         return match.replace(/,"?$/, '').replace(/^"?,/, '');
//       });
  
//       if (values.length >= 3) {
//         const secondValue = values[1]; // Second quoted value
//         const thirdValue = values[2];  // Third unquoted value
  
//         // Split the second value by commas and convert to numbers if needed
//         const secondValueArray = secondValue.split(',').map(item => item.trim());
  
//         // Remove quotes from the first and fifth values
//         if (secondValueArray.length > 0) {
//           secondValueArray[0] = secondValueArray[0].replace(/"/g, '');
//         }
//         if (secondValueArray.length > 4) {
//           secondValueArray[4] = secondValueArray[4].replace(/"/g, '');
//         }
  
//         results.push([...secondValueArray, thirdValue]);
//       }
//     }
//     return results;
//   }

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

  function isRandom(numbers) {
    // 1. Run-Length Encoding (RLE) Compression Test
    const compressed = runLengthEncoding(numbers);
    const compressionRatio = numbers.length / compressed.length;
    if (compressionRatio < 1.5) {
        // If the compression ratio is low, the sequence is more random
        console.log('Compression Test: Sequence appears random.');
    } else {
        console.log('Compression Test: Sequence may not be random.');
    }

    // 2. Pattern Matching Test
    const patternLength = 3;
    const hasRepeatingPattern = checkForRepeatingPatterns(numbers, patternLength);
    if (!hasRepeatingPattern) {
        console.log('Pattern Test: No significant repeating patterns found.');
    } else {
        console.log('Pattern Test: Repeating patterns detected.');
    }

    // 3. Frequency Analysis
    const frequencyDistribution = getFrequencyDistribution(numbers);
    const chiSquareResult = performChiSquareTest(frequencyDistribution);
    if (chiSquareResult > 0.05) {
        console.log('Frequency Test: Distribution appears uniform.');
    } else {
        console.log('Frequency Test: Distribution may not be uniform.');
    }

    // Combine the results to determine overall randomness
    return compressionRatio < 1.5 && !hasRepeatingPattern && chiSquareResult > 0.05;
}

// Helper function for Run-Length Encoding
function runLengthEncoding(numbers) {
    let encoded = [];
    let current = numbers[0];
    let count = 1;
    for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] === current) {
            count++;
        } else {
            encoded.push({ value: current, count: count });
            current = numbers[i];
            count = 1;
        }
    }
    encoded.push({ value: current, count: count });
    return encoded;
}

// Helper function to check for repeating patterns
function checkForRepeatingPatterns(numbers, patternLength) {
    if (numbers.length <= patternLength) {
        return false;
    }
    let pattern = numbers.slice(0, patternLength);
    for (let i = patternLength; i < numbers.length; i++) {
        let currentPattern = numbers.slice(i - patternLength + 1, i + 1);
        if (arraysEqual(pattern, currentPattern)) {
            return true;
        }
    }
    return false;
}

// Helper function to compare arrays
function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Helper function to get frequency distribution
function getFrequencyDistribution(numbers) {
    const frequency = {};
    for (const num of numbers) {
        frequency[num] = (frequency[num] || 0) + 1;
    }
    return frequency;
}

// Helper function to perform chi-square test
function performChiSquareTest(frequencyDistribution) {
    const expected = Object.keys(frequencyDistribution).length;
    let chiSquare = 0;
    for (const count of Object.values(frequencyDistribution)) {
        const observed = count;
        chiSquare += Math.pow(observed - expected, 2) / expected;
    }
    // For this example, we'll use a simplified chi-square test
    // In a real scenario, you would compare against a chi-square distribution table
    return chiSquare;
}


// Function to generate numbers based on frequencies
function getMostFrequentNumbers(count, frequencyMap) {
  // Convert map to array and sort by frequency
  const sortedEntries = Array.from(frequencyMap.entries()).sort(([,a],[,b]) => b - a);
  const numbers = [];
  
  // Take top 'count' numbers
  for(let i = 0; i < count && i < sortedEntries.length; i++) {
      numbers.push(sortedEntries[i][0]);
  }
  
  return numbers;
}

function adjustNumber(number, index, numberFrequencies, thirdItemFrequencies) {
  // Randomly decide whether to add or subtract 1
  const adjustment = Math.random() < 0.5 ? 1 : -1;
  let adjustedNumber = number + adjustment;

  if (index < 5) {  // First 5 numbers
      // Get min and max from numberFrequencies map
      const validNumbers = Array.from(numberFrequencies.keys());
      const minAllowed = Math.min(...validNumbers);
      const maxAllowed = Math.max(...validNumbers);

      // Ensure number stays within bounds
      if (adjustedNumber < minAllowed) {
          adjustedNumber = minAllowed;
      } else if (adjustedNumber > maxAllowed) {
          adjustedNumber = maxAllowed;
      }
  } else {  // Last number (index 5)
      // Get min and max from thirdItemFrequencies map
      const validNumbers = Array.from(thirdItemFrequencies.keys());
      const minAllowed = Math.min(...validNumbers);
      const maxAllowed = Math.max(...validNumbers);

      // Ensure number stays within bounds
      if (adjustedNumber < minAllowed) {
          adjustedNumber = minAllowed;
      } else if (adjustedNumber > maxAllowed) {
          adjustedNumber = maxAllowed;
      }
  }

  return adjustedNumber;
}

export function processCsvAndGenerateNumbers(arrayOfArrays) {
  // Skip the first array and process the rest
  const numberArrays = arrayOfArrays.slice(1);
  
  // Frequency map for first 5 numbers
  const numberFrequencies = new Map();
  // Frequency map for sixth number
  const thirdItemFrequencies = new Map();

  numberArrays.forEach(numbers => {
      // Process first 5 numbers
      numbers.slice(0, 5).forEach(num => {
          const cleanNum = parseInt(num);
          numberFrequencies.set(cleanNum, (numberFrequencies.get(cleanNum) || 0) + 1);
      });

      // Process sixth number
      const sixthNum = parseInt(numbers[5]);
      thirdItemFrequencies.set(sixthNum, (thirdItemFrequencies.get(sixthNum) || 0) + 1);
  });

  // Generate first 5 numbers based on first frequency map
  const firstFiveNumbers = getMostFrequentNumbers(5, numberFrequencies);
  
  // Generate sixth number based on last number frequencies
  const sixthNumber = getMostFrequentNumbers(1, thirdItemFrequencies)[0];

  // Combine to create the initial set
  let numberSet = [...firstFiveNumbers, sixthNumber];

  // Function to adjust numbers to meet randomness criteria
  function adjustNumber(number, index, numberFrequencies, thirdItemFrequencies) {
      // Randomly decide whether to add or subtract 1
      const adjustment = Math.random() < 0.5 ? 1 : -1;
      let adjustedNumber = number + adjustment;

      if (index < 5) {  // First 5 numbers
          // Get min and max from numberFrequencies map
          const validNumbers = Array.from(numberFrequencies.keys());
          const minAllowed = Math.min(...validNumbers);
          const maxAllowed = Math.max(...validNumbers);

          // Ensure number stays within bounds
          if (adjustedNumber < minAllowed) {
              adjustedNumber = minAllowed;
          } else if (adjustedNumber > maxAllowed) {
              adjustedNumber = maxAllowed;
          }
      } else {  // Last number (index 5)
          // Get min and max from thirdItemFrequencies map
          const validNumbers = Array.from(thirdItemFrequencies.keys());
          const minAllowed = Math.min(...validNumbers);
          const maxAllowed = Math.max(...validNumbers);

          // Ensure number stays within bounds
          if (adjustedNumber < minAllowed) {
              adjustedNumber = minAllowed;
          } else if (adjustedNumber > maxAllowed) {
              adjustedNumber = maxAllowed;
          }
      }

      return adjustedNumber;
  }

  // Check and adjust numbers if necessary
  while (!isRandom(numberSet)) {
      console.log('Adjusting numbers to meet randomness criteria...');
      numberSet = numberSet.map((num, index) => 
          adjustNumber(num, index, numberFrequencies, thirdItemFrequencies)
      );
  }

  return numberSet;
}