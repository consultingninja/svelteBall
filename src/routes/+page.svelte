<script>
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import Circle from '$lib/circle/circle.svelte';
    import { createEngine, defaultConfig, WEIGHTING_STRATEGIES } from '$lib/engine/index.js';

    const CONFIG_KEY = 'svelteball-config-v1';

    let draws = null;
    let sets = [];
    let ticket = { regular_balls: [], powerball: null };
    let error = '';
    let loading = false;
    let showOptions = false;
    let statsLine = '';

    // --- user-configurable state ---
    let mode = 'sets';              // 'sets' | 'set' | 'ticket'
    let engineChoice = 'algorithm'; // 'algorithm' | 'slm'
    let numSets = 5;
    let config = structuredClone(defaultConfig);

    onMount(async () => {
        try {
            const saved = localStorage.getItem(CONFIG_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                config = { ...structuredClone(defaultConfig), ...parsed.config };
                mode = parsed.mode ?? mode;
                numSets = parsed.numSets ?? numSets;
                engineChoice = parsed.engineChoice ?? engineChoice;
            }
        } catch { /* corrupted saved config: fall back to defaults */ }

        try {
            const res = await fetch('/draws.json');
            draws = await res.json();
        } catch (e) {
            error = 'Could not load historical draw data.';
        }
    });

    function persist() {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify({ config, mode, numSets, engineChoice }));
        } catch { /* storage unavailable (private mode) */ }
    }
    $: config, mode, numSets, engineChoice, typeof localStorage !== 'undefined' && persist();

    function buildEngine() {
        return createEngine(draws, config);
    }

    async function generate() {
        error = '';
        if (!draws) { error = 'Historical data not loaded yet.'; return; }
        loading = true;
        try {
            if (engineChoice === 'slm') {
                await generateWithSlm();
            } else {
                generateWithAlgorithm();
            }
        } catch (e) {
            error = e.message;
        } finally {
            loading = false;
        }
    }

    function generateWithAlgorithm() {
        const engine = buildEngine();
        statsLine = `${engine.drawCount} confirmed draws analyzed · hot: ${engine.statistics.hotNumbers.slice(0, 5).join(', ')}`;
        if (mode === 'sets') {
            sets = engine.generateSets(numSets);
        } else if (mode === 'set') {
            sets = [engine.generateSet()];
        } else {
            addTicketBall(engine);
        }
    }

    async function generateWithSlm() {
        const res = await fetch('/api/slm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode,
                count: mode === 'sets' ? numSets : 1,
                exclude: mode === 'ticket' ? ticket.regular_balls : [],
                wantPowerball: mode === 'ticket' && ticket.regular_balls.length >= 5,
                veto: config.veto
            })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'AI model unavailable. Run "npm run slm:serve" and try again.');
        }
        const data = await res.json();
        if (mode === 'ticket') {
            if (data.ball != null) ticket.regular_balls = [...ticket.regular_balls, data.ball].sort((a, b) => a - b);
            if (data.powerball != null) ticket.powerball = data.powerball;
            ticket = ticket;
        } else {
            sets = data.sets;
        }
    }

    function addTicketBall(engine) {
        if (ticket.regular_balls.length < 5) {
            const ball = engine.generateBall(ticket.regular_balls);
            ticket.regular_balls = [...ticket.regular_balls, ball].sort((a, b) => a - b);
        } else if (ticket.powerball === null) {
            ticket.powerball = engine.generatePowerball();
        }
        ticket = ticket;
    }

    async function addTicketPowerball() {
        error = '';
        if (!draws) return;
        if (engineChoice === 'slm') {
            loading = true;
            try {
                const res = await fetch('/api/slm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'ticket', wantPowerball: true, exclude: [] })
                });
                if (!res.ok) throw new Error('AI model unavailable.');
                const data = await res.json();
                ticket.powerball = data.powerball;
                ticket = ticket;
            } catch (e) {
                error = e.message;
            } finally {
                loading = false;
            }
        } else {
            ticket.powerball = buildEngine().generatePowerball();
            ticket = ticket;
        }
    }

    function clearTicket() {
        ticket = { regular_balls: [], powerball: null };
    }

    function handleDelete(index) {
        sets = sets.filter((_, i) => i !== index);
    }

    function resetConfig() {
        config = structuredClone(defaultConfig);
    }
</script>

<div class="header-wrapper">
    <h1>PowerBall Generator</h1>
    <h2>Friends and family release — good luck!</h2>
    <p class="disclaimer">Draws are random; no generator can predict them. These picks are statistically shaped for fun.</p>

    <div class="controls">
        <div class="control-group">
            <label for="mode">Generate</label>
            <select id="mode" bind:value={mode}>
                <option value="sets">Multiple sets</option>
                <option value="set">Single set</option>
                <option value="ticket">Build a ticket (ball by ball)</option>
            </select>
            {#if mode === 'sets'}
                <input type="number" min="1" max="20" bind:value={numSets} aria-label="Number of sets" />
            {/if}
        </div>

        <div class="control-group">
            <label for="engine">Engine</label>
            <select id="engine" bind:value={engineChoice}>
                <option value="algorithm">Algorithm (on device)</option>
                <option value="slm">AI model (local fine-tune)</option>
            </select>
        </div>

        {#if mode === 'ticket'}
            <button class="btn" on:click={generate} disabled={loading || (ticket.regular_balls.length >= 5 && ticket.powerball !== null)}>+ Ball</button>
            <button class="btn" on:click={addTicketPowerball} disabled={loading || ticket.powerball !== null}>+ Powerball</button>
            <button class="btn subtle" on:click={clearTicket}>Clear</button>
        {:else}
            <button class="btn" on:click={generate} disabled={loading}>Generate</button>
        {/if}
        <button class="btn subtle" on:click={() => (showOptions = !showOptions)}>
            {showOptions ? 'Hide options' : 'Options'}
        </button>
    </div>

    {#if showOptions}
        <div class="options" transition:fade={{ duration: 150 }}>
            <fieldset>
                <legend>Weighting</legend>
                <label>
                    Strategy
                    <select bind:value={config.weighting}>
                        {#each WEIGHTING_STRATEGIES as s}<option value={s}>{s}</option>{/each}
                    </select>
                </label>
                {#if config.weighting === 'exponential'}
                    <label>Half-life (draws) <input type="number" min="10" max="2000" bind:value={config.halfLifeDraws} /></label>
                {/if}
                <label><input type="checkbox" bind:checked={config.favorHot} /> Favor hot numbers</label>
                <label><input type="checkbox" bind:checked={config.avoidCold} /> Avoid cold numbers</label>
                <label><input type="checkbox" bind:checked={config.usePatterns} /> Boost historical pairs</label>
            </fieldset>

            <fieldset>
                <legend>Veto rules</legend>
                <label><input type="checkbox" bind:checked={config.veto.enabled} /> Enabled</label>
                {#if config.veto.enabled}
                    <label>Max consecutive <input type="number" min="1" max="5" bind:value={config.veto.maxConsecutive} /></label>
                    <label>Sum range
                        <span class="pair">
                            <input type="number" min="15" max="335" bind:value={config.veto.sumRange.min} />
                            – <input type="number" min="15" max="335" bind:value={config.veto.sumRange.max} />
                        </span>
                    </label>
                    <label>Max same last digit <input type="number" min="1" max="5" bind:value={config.veto.maxSameLastDigit} /></label>
                    <label>Max in one decade <input type="number" min="1" max="5" bind:value={config.veto.maxInOneDecade} /></label>
                    <label><input type="checkbox" bind:checked={config.veto.vetoArithmeticProgression} /> Veto arithmetic progressions</label>
                    <label><input type="checkbox" bind:checked={config.veto.vetoCommonDivisor} /> Veto shared divisors</label>
                    <label><input type="checkbox" bind:checked={config.veto.powerballProximity.enabled} /> Keep powerball away from regulars</label>
                {/if}
            </fieldset>

            <fieldset>
                <legend>Batch diversity</legend>
                <label>Max shared numbers between sets <input type="number" min="0" max="5" bind:value={config.batch.maxOverlap} /></label>
                <label>Max uses of one number per batch <input type="number" min="1" max="20" bind:value={config.batch.maxPerNumberUsage} /></label>
            </fieldset>

            <button class="btn subtle" on:click={resetConfig}>Reset to defaults</button>
        </div>
    {/if}

    {#if loading}
        <div class="circle-wrapper"><Circle /></div>
    {/if}

    {#if error}
        <h2 class="error">{error}</h2>
    {/if}

    {#if statsLine}
        <p class="stats">{statsLine}</p>
    {/if}
</div>

<div class="container-wrapper">
    {#if mode === 'ticket'}
        <div class="ball-container">
            {#each ticket.regular_balls as ball (ball)}
                <div transition:fade={{ delay: 100, duration: 300 }} class="ball"><span>{ball}</span></div>
            {/each}
            {#each Array(5 - ticket.regular_balls.length) as _}
                <div class="ball placeholder"><span>?</span></div>
            {/each}
            {#if ticket.powerball !== null}
                <div transition:fade={{ delay: 100, duration: 300 }} class="powerball"><span>{ticket.powerball}</span></div>
            {:else}
                <div class="powerball placeholder"><span>?</span></div>
            {/if}
        </div>
    {:else}
        {#each sets as set, setIndex (setIndex)}
            <div class="ball-container">
                {#each set.regular_balls as ball, index (index)}
                    <div transition:fade={{ delay: 250, duration: 300 }} class="ball"><span>{ball}</span></div>
                {/each}
                <div transition:fade={{ delay: 250, duration: 300 }} class="powerball"><span>{set.powerball}</span></div>
                <button class="btn-delete" on:click={() => handleDelete(setIndex)} transition:fade={{ delay: 250, duration: 300 }} aria-label="Delete set">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        {/each}
    {/if}
</div>

<style>
    .btn {
        padding: 0.5em 1.2em;
        background-color: #b31212;
        color: #fff;
        border: none;
        border-radius: 4px;
        font-size: 1em;
        cursor: pointer;
    }
    .btn:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .btn.subtle {
        background-color: #3a3a3a;
    }
    .btn:not(:disabled):hover {
        box-shadow: 0 0 10px #fff5;
        transition: all 0.2s ease-in-out;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75em;
        align-items: flex-end;
        justify-content: center;
        margin-top: 1em;
    }
    .control-group {
        display: flex;
        flex-direction: column;
        gap: 0.25em;
        font-size: 0.9em;
    }
    .control-group select, .control-group input {
        padding: 0.45em;
        background: #242424;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
    }
    .control-group input[type='number'] {
        width: 5em;
    }
    .options {
        display: flex;
        flex-wrap: wrap;
        gap: 1em;
        justify-content: center;
        margin-top: 1em;
        max-width: 60em;
    }
    .options fieldset {
        border: 1px solid #555;
        border-radius: 6px;
        padding: 0.75em 1em;
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        min-width: 16em;
        text-align: left;
    }
    .options label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75em;
        font-size: 0.9em;
    }
    .options input[type='number'], .options select {
        width: 6em;
        padding: 0.3em;
        background: #242424;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
    }
    .options .pair {
        display: flex;
        align-items: center;
        gap: 0.3em;
    }
    .options .pair input {
        width: 4.5em;
    }
    .disclaimer {
        font-size: 0.85em;
        opacity: 0.7;
        margin: 0.25em 0 0;
    }
    .stats {
        font-size: 0.85em;
        opacity: 0.7;
    }
    .error {
        color: #ff7676;
    }
    .btn-delete {
        height: 3.5em;
        width: 3.5em;
        margin-left: 0.25em;
        background-color: #242424;
        text-align: center;
        border: none;
    }
    .btn-delete:hover {
        box-shadow: 0 0 10px #fff;
        transition: all 0.2s ease-in-out;
        opacity: 0.5;
        cursor: pointer;
    }
    .material-symbols-outlined {
        color: #fff;
        height: auto;
    }
    .container-wrapper {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        flex-wrap: wrap;
    }
    .header-wrapper {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-top: 1em;
        text-align: center;
    }
    .circle-wrapper {
        margin-top: 1em;
    }
    .ball-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1em;
        font-size: larger;
        margin-right: 1em;
    }
    .ball {
        background-color: #fff;
        color: #242424;
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: 1em;
        margin-bottom: 0.5em;
        padding: 0.5em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .powerball {
        background-color: #b31212;
        color: #fff;
        height: 30px;
        width: 30px;
        border-radius: 50%;
        margin-right: 0.3em;
        margin-bottom: 0.5em;
        padding: 0.5em;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .placeholder {
        opacity: 0.3;
    }
</style>
