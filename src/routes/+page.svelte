<script>
    import { fade } from 'svelte/transition';
    let sets = [];
    let error = false;
    export let data;


//https://svelte-ball.vercel.app
     function getSet(topRegBalls,topPowerBalls){
        console.log("hello? wtf", topRegBalls,topPowerBalls)
        console.log(data);
        let set = [];
        if(!topRegBalls || !topPowerBalls)return 

        while (set.length < 5) {
            let randomIndex = Math.floor(Math.random() * topRegBalls.length);
            let randomObject = topRegBalls[randomIndex];
          
            if (!set.includes(randomObject.key)) {
                set.push(parseInt(randomObject.key));
            }
          }
          let randomIndex = Math.floor(Math.random() * topPowerBalls.length);
          let randomObject = topPowerBalls[randomIndex];
            set.push(parseInt(randomObject.key));
            sets.push(set)
            const newArray = [...sets];
            sets = newArray;

            console.log('sets',sets);

        }





</script>


<h1>Welcome to Consutling Ninja</h1>
<h2>I wish you luck!</h2>
<button on:click={getSet(data.ballInfo.topRegBalls,data.ballInfo.topPowerBalls)}>Generate Set</button>
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