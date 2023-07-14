import cheerio from 'cheerio';
import  axios from 'axios';


async function webScrapingExample() {
    let year  = 2016 ;
    let regBalls = {};
    let powerBalls = {};
    let ballForStd = [];
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
        });
        //Find all power balls
        $(".powerball").each((i, elem) => {
            const text = $(elem).text();
            powerBalls[text] = powerBalls[text] ? powerBalls[text] + 1 : 1;
        });
      
        year++

    }

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


  return {topRegBalls ,topPowerBalls, std }
}

export async function GET(){
const results = await webScrapingExample()
//const data = await results.json()
return new Response(JSON.stringify(results),{status:200})

}