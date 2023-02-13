<script>
    import { fade } from 'svelte/transition';
    let sets = [];
    let error = false;
    export let data;


//https://svelte-ball.vercel.app
     function getSet(topRegBalls,topPowerBalls){
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

            sets = sets

            console.log('sets',sets);

        }

        function handleDelete(index){
            sets.splice(index,1);
            sets = sets
        }





</script>

<div class="header-wrapper">
<h1>Welcome to the PowerBall Generator (Beta)</h1>
<h2>This is friends and family release.</h2>
<h2>I wish you luck!</h2>
<button on:click={getSet(data.ballInfo.topRegBalls,data.ballInfo.topPowerBalls)}>Generate Set</button>
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