import cheerio from 'cheerio';
import  axios from 'axios';

function combineArrays(arr1, arr2) {

    // Validate input
    if(arr1.length % 5 !== 0) {
      throw new Error('First array length must be a multiple of 5');
    }
    if(arr1.length / 5 !== arr2.length) {
      throw new Error('First array must be 5 times longer than second array'); 
    }
  
    const result = [];
  
    for(let i=0; i < arr2.length; i++) {
      const group = arr1.slice(i*5, i*5 + 5);
      group.push(arr2[i]);
      result.push(group);
    }
  
    return result;
  
  }

async function webScrapingExample() {
    let year  = 2016 ;
    let regBalls = {};
    let powerBalls = {};
    let ballForStd = [];
    let regBallNumbers = [];
    let powerBallNumbers = [];
    const baseReq = `https://www.powerball.net/archive/` ;
    while(year < 2023){
        const currentReq = `https://www.powerball.net/archive/${year}`
        const response = await axios.get(currentReq);
        const $ = cheerio.load(response.data);
        
        // Find all regular balls
        $(".ball").each((i, elem) => {
            const text = $(elem).text();
            regBalls[text] = regBalls[text] ? regBalls[text] + 1 : 1;
            ballForStd.push(parseInt(text));
            regBallNumbers.push(parseInt(text));
        });
        //Find all power balls
        $(".powerball").each((i, elem) => {
            const text = $(elem).text();
            powerBalls[text] = powerBalls[text] ? powerBalls[text] + 1 : 1;
            powerBallNumbers.push(parseInt(text));
        });
      
        year++

    }

    const allResults = combineArrays(regBallNumbers,powerBallNumbers);
    console.log(allResults);

    //create arrays of key value pairs
    let regBallArray  = [];
    let powerBallArray = [];
    for (let key in regBalls) {
        regBallArray.push({ key, value: regBalls[key] });
    }
    for (let key in powerBalls) {
        powerBallArray.push({ key, value: powerBalls[key] });
    }
    //sort arrays(descending)
    regBallArray.sort((a, b) => b.value - a.value); 
    powerBallArray.sort((a, b) => b.value - a.value); 

    
    console.log(regBallArray.slice(0,10));
    console.log(powerBallArray.slice(0,10));
    const topRegBalls = regBallArray.slice(0,10);
    const topPowerBalls = powerBallArray.slice(0,10);

    // Step 1: Calculate the mean
    const mean = ballForStd.reduce((acc, num) => acc + num, 0) / ballForStd.length;

    // Step 2: Calculate the squared difference from the mean for each number
    const squaredDifferences = ballForStd.map(num => Math.pow(num - mean, 2));

    // Step 3: Calculate the mean of the squared differences
    const meanOfSquaredDifferences = squaredDifferences.reduce((acc, num) => acc + num, 0) / ballForStd.length;

    // Step 4: Calculate the standard deviation (square root of the mean of squared differences)
    const std = Math.sqrt(meanOfSquaredDifferences).toFixed(1);


  return {topRegBalls ,topPowerBalls, std , allResults }
}

export async function GET(){
const results = await webScrapingExample()
//const data = await results.json()
return new Response(JSON.stringify(results),{status:200})

}