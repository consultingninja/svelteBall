<script>
    import { fade } from 'svelte/transition';
    let sets = [];
    let error = false;
    export let data;


//https://svelte-ball.vercel.app
function getSet(topRegBalls,topPowerBalls){
        let set = new Set();
        if(!topRegBalls || !topPowerBalls) return;
        while(set.size < 5){
            let randomIndex = Math.floor(Math.random() * topRegBalls.length);
            let randomObject = topRegBalls[randomIndex];
            if(!set.has(parseInt(randomObject.key))){
            set.add(parseInt(randomObject.key));
            }
        }
        let redBallAdded = false;
        while(!redBallAdded){
            let randomIndex = Math.floor(Math.random() * topPowerBalls.length);
            let randomObject = topPowerBalls[randomIndex];
            if(!set.has(parseInt(randomObject.key))){
            set.add(parseInt(randomObject.key));
            redBallAdded = true;
            }
        }
        sets.push(Array.from(set));
        sets = sets;
        console.log('sets', sets);
        }

        function handleDelete(index){
            sets.splice(index,1);
            sets = sets
        }

    //function to calculate standard deviation
    function stdDeviation(numbers){
    // Step 1: Calculate the mean
    const mean = numbers.reduce((acc, num) => acc + num, 0) / numbers.length;

    // Step 2: Calculate the squared difference from the mean for each number
    const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));

    // Step 3: Calculate the mean of the squared differences
    const meanOfSquaredDifferences = squaredDifferences.reduce((acc, num) => acc + num, 0) / numbers.length;

    // Step 4: Calculate the standard deviation (square root of the mean of squared differences)
    const std = Math.sqrt(meanOfSquaredDifferences);
    return std.toFixed(1)
    }


function generateNumberSets(ballinfo, powerballinfo, std) {
    console.log('std', std);
    let row = [];

    // Generate first 5 numbers
    let between20and30 = 0;
    for (let j = 0; j < 5; j++) {
      let num = Math.floor(Math.random() * 69) + 1;
      if (num >= 20 && num <= 30) {
        between20and30++;
      }
      row.push(num);
    }

    // Tweak numbers if needed
    if (between20and30 < 3) {
      row = adjustNumbersToRanges(row);
    }

    // Calculate std dev
    const stdDev = stdDeviation(row);

    // Tweak numbers if std dev is off
    if (stdDev !== std) {
      row = adjustNumbersToStdDev(row, 17);
    }

    // Row is good, add powerball and push

    const lastNum = Math.floor(Math.random() * 26) + 1;
    row.push(lastNum);
    
    sets.push(row);
    sets = sets;
  



}

function adjustNumbersToRanges(row) {
    console.log('adjusting Numbers To Ranges', row);
  const rangeMin = 20;
  const rangeMax = 30;

  while (getInRangeCount(row, rangeMin, rangeMax) < 3) {
    const index = Math.floor(Math.random() * row.length); 

    const newValue = getRandomNumberInRange(rangeMin, rangeMax);
    row[index] = newValue;
  }

  return row;
}
function getRandomNumberInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getInRangeCount(row, min, max) {

  let count = 0;
  for (let i = 0; i <= 5; i++) {
    if (row[i] >= min && row[i] <= max) {
      count++;
    }
  }

  return count;

}

function adjustNumbersToStdDev(row, targetStdDev) {
  let currentStdDev = stdDeviation(row);

  if (currentStdDev === 0) {
    // Avoid division by zero if the current standard deviation is zero
    stdDeviation = 1;
  }

  const scaleFactor = targetStdDev / currentStdDev;
  const duplicates = {};

  for (let i = 0; i < row.length; i++) {
    const originalValue = row[i];
    const adjustedValue = Math.round(originalValue * scaleFactor);
    const newValue = Math.min(Math.max(adjustedValue, 1), 68);

    if (duplicates[newValue]) {
      // Duplicate value detected, replace it with a random number
      row[i] = getRandomNumberInRange(1, 69);
    } else {
      row[i] = newValue;
      duplicates[newValue] = true;
    }
  }

  return row;
}



</script>

<div class="header-wrapper">
<h1>Welcome to the PowerBall Generator (Beta)</h1>
<h2>This is a friends and family release.</h2>
<h2>I wish you luck!</h2>
<button on:click={generateNumberSets(data.ballInfo.topRegBalls,data.ballInfo.topPowerBalls,data.ballInfo.std)}>Generate Set</button>
<button on:click={generateNumberSets(data.ballInfo.topRegBalls,data.ballInfo.topPowerBalls,data.ballInfo.std)}>Generate Enhanced Set</button>

</div>
<div class="container-wrapper">

    {#each sets as set, setIndex (setIndex)}
        <div class="ball-container" >
            {#each set as ball, index (index)}
                <div transition:fade="{{delay: 250, duration: 300}}" class={index <5? 'ball' : 'powerball'}><span>{ball}</span></div>
            {/each}
            <button class="btn-delete" on:click={handleDelete(setIndex)} transition:fade="{{delay: 250, duration: 300}}" >
                <span class="material-symbols-outlined">
                    delete
                    </span>
            </button>
        </div>
    {/each}

</div>

<style>
    .btn-delete{
        height: 3.5em;
        width: 3.5em;
        margin-left: .25em;
        background-color: #242424;
        text-align: center;
    }
    .btn-delete:hover{
        box-shadow: 0 0 10px #fff;
        transition: all 0.2s ease-in-out;
        opacity: .5;
        cursor:pointer
    }
    .material-symbols-outlined{
        color:#FFF;
        height: auto;
    }
    .container-wrapper{
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        flex-wrap: wrap;
    }
    .ball-container{

        display: flex;
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1em;
        font-size: larger;
        margin-right: 1em;
    }
    .ball{
        background-color: #FFF;
        color: #242424;
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: 1em;
        margin-bottom: .5em;
        padding: .5em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .powerball{
        background-color: #b31212;
        color: #FFF;
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: .3em;
        margin-bottom: .5em;
        padding: .5em;
        display: flex;
        justify-content: center;
        align-items: center;
    }


</style>