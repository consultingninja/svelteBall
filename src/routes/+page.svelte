<script>
    import { fade } from 'svelte/transition';
    import Circle from '$lib/circle/circle.svelte';

    let sets = [];
    let explanation = '';
    let error = false;
    let errorText = '';
    let loading = false;

    function parseJSONFromString(data) {
    let jsonData;
    try {
        // Attempt to parse the string as JSON
        jsonData = JSON.parse(data);
    } catch (error) {
        // Parsing failed, try to extract JSON object from the string
        try{
            const startIndex = data.indexOf('{');
        const endIndex = data.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            const jsonString = data.substring(startIndex, endIndex + 1);
            try {
                jsonData = JSON.parse(jsonString);
            } catch (error) {
                console.error('Failed to parse JSON:', error);
                jsonData = undefined; // Or any other fallback value
            }
        } else {
            console.error('No JSON object found in the string.');
            jsonData = undefined; // Or any other fallback value
        }
        }catch(error){
            console.error('Failed to extract JSON object from the string:', error);
            jsonData = undefined; // Or any other fallback value
        }

    }
    return jsonData;
}


    async function getAI(){
        error = false;
        loading = true;
        const res = await fetch('/api/ai');
        if(res.status !== 200){
            error = true;
            errorText = res.statusText;
            loading = false;
            return;
        }
        const data = await res.json();
        console.log("Data: ",data);

        sets = [...data.sets];
        loading = false;
        return;

        

        // Parse the JSON string into a JavaScript object
        
        const jsonObject = parseJSONFromString(data);
        console.log("Text property with additional parsing checks",jsonObject);
        if(jsonObject === undefined){
            error = true;
            loading = false;
            return;
        }
        // Check for sets property
        if(!jsonObject.hasOwnProperty('sets')){
            error = true;
            loading = false;
            return;
        }
        sets = [...jsonObject.sets];

        // Check for explanation property
        if(jsonObject.hasOwnProperty('explanation')){
            explanation = jsonObject.explanation;
        }
        loading = false;

}


    function handleDelete(index){
            sets.splice(index,1);
            sets = sets
        }



</script>

<div class="header-wrapper">
<h1>Welcome to the NEW PowerBall Generator (Beta)</h1>
<h2>This is a friends and family release.</h2>
<h2>I wish you luck!</h2>
<button on:click={getAI}>AI Set</button>

{#if loading}
  <div class="circle-wrapper">
    <Circle/>
  </div>

{/if}

{#if error}
    <h2>There was an error generating the set. Please try again.</h2>
    <small>{errorText}</small>
{/if}


</div>
<div class="container-wrapper">

    {#each sets as set, setIndex (setIndex)}
        <div class="ball-container" >
            {#each set.regularBalls as ball, index (index)}
                <div transition:fade="{{delay: 250, duration: 300}}" class='ball'><span>{ball}</span></div>
            {/each}
            <div transition:fade="{{delay: 250, duration: 300}}" class='powerball'><span>{set.powerBall}</span></div>
            <button class="btn-delete" on:click={handleDelete(setIndex)} transition:fade="{{delay: 250, duration: 300}}" >
                <span class="material-symbols-outlined">
                    delete
                    </span>
            </button>
        </div>
    {/each}

    <div>
        <p>{explanation}</p>
    </div>

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
    .header-wrapper{
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-top: 1em;
    }
    .circle-wrapper{
      margin-top: 1em;
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