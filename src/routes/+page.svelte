<script>
    import { fade } from 'svelte/transition';
    import { onMount } from 'svelte';
    let sets = [];
    let error = false;
    let ballInfo = {};

    onMount(async() => {
        const response = await fetch('http://localhost:5173/api/scrapeWeb',{method:"GET"});
        const responseData = await response.json();
        ballInfo['topRegBalls'] = responseData.ballInfo.topRegBalls;
        ballInfo['topPowerBalls']  = responseData.ballInfo.topPowerBalls;
    });
//https://svelte-ball.vercel.app
    async function getSet(topRegBalls,topPowerBalls){
        try{
            const response = await  fetch('http://localhost:5173/api/generateSet', {method:"POST",body:JSON.stringify({whiteBalls:topRegBalls, redBalls: topPowerBalls})});
            const responseData = await response.json();
            sets.push(responseData.set)
            const newArray = [...sets];
            sets = newArray;

        }
        catch{

        }


    }




</script>


<h1>Welcome to Consutling Ninja</h1>
<h2>I wish you luck!</h2>
<button on:click={getSet(ballInfo.topRegBalls,ballInfo.topPowerBalls)}>Generate Set</button>
{#if sets.length > 0}
    <div class="ball-container" >
    {#each sets as set, index}

            {#each set as ball, index}
                <div transition:fade="{{delay: 250, duration: 300}}" class={index <5? 'ball' : 'powerball'}><span>{ball}</span></div>
            {/each}

    {/each}
    </div>
    {:else}
    <p>No sets yet, would you like to generate one?</p>
{/if}

<style>
    .ball-container{
        display: flex;
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1em;
        font-size: larger;

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
        margin-right: 1em;
        margin-bottom: .5em;
        padding: .5em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>