// import cheerio from 'cheerio';
// import  axios from 'axios';

// async function webScrapingExample() {
//     let year  = 2016 ;
//     let regBalls = {};
//     let powerBalls = {};
//     const baseReq = `https://www.powerball.net/archive/` ;
//     while(year < 2023){
//         const currentReq = `https://www.powerball.net/archive/${year}`
//         const response = await axios.get(currentReq);
//         const $ = cheerio.load(response.data);
        
//         // Find all regular balls
//         $(".ball").each((i, elem) => {
//             const text = $(elem).text();
//             regBalls[text] = regBalls[text] ? regBalls[text] + 1 : 1;
//         });
//         //Find all power balls
//         $(".powerball").each((i, elem) => {
//             const text = $(elem).text();
//             powerBalls[text] = powerBalls[text] ? powerBalls[text] + 1 : 1;
//         });
      
//         year++

//     }

//     //create arrays of key value pairs
//     let regBallArray  = [];
//     let powerBallArray = [];
//     for (let key in regBalls) {
//         regBallArray.push({ key, value: regBalls[key] });
//     }
//     for (let key in powerBalls) {
//         powerBallArray.push({ key, value: powerBalls[key] });
//     }
//     //sort arrays(descending)
//     regBallArray.sort((a, b) => b.value - a.value); 
//     powerBallArray.sort((a, b) => b.value - a.value); 

    
//     console.log(regBallArray.slice(0,10));
//     console.log(powerBallArray.slice(0,10));
//     const topRegBalls = regBallArray.slice(0,10);
//     const topPowerBalls = powerBallArray.slice(0,10);
//   return {topRegBalls ,topPowerBalls }
// }

export async function load({fetch}){
    console.log('loading...');

    const response = await fetch('/api/scrapeWeb');
    const data = await response.json()
    return{
        ballInfo: data
    }
}
