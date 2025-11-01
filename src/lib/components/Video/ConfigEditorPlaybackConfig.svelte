<script>
    import { Label, Button } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';

    const DEFAULT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const MIN_RATE = DEFAULT_RATES[0];
    const MAX_RATE = DEFAULT_RATES[DEFAULT_RATES.length - 1];
    const isApproximatelyEqual = (a, b) => Math.abs(a - b) < 1e-3;

    export let rate = 1;
    export let timeIndicator = '';

    const dispatch = createEventDispatcher();

    let localTimeIndicator = timeIndicator;
    let allowedRates = [...DEFAULT_RATES];
    let rateIndex = 0;
    let manualRate = '';

    $: localTimeIndicator = timeIndicator;
    $: syncFromExternalRate(Number(rate));
    $: currentRate = allowedRates[rateIndex] ?? 1;

    function syncFromExternalRate(externalRate) {
        if (Number.isNaN(externalRate)) {
            return;
        }

        if (!allowedRates.some((value) => isApproximatelyEqual(value, externalRate))) {
            allowedRates = [...allowedRates, externalRate].sort((a, b) => a - b);
        }

        const nextIndex = allowedRates.findIndex((value) => isApproximatelyEqual(value, externalRate));
        if (nextIndex !== -1 && nextIndex !== rateIndex) {
            rateIndex = nextIndex;
        }

        manualRate = formatRate(externalRate);
    }

    const formatRate = (value) => {
        const numeric = Number(value) || 1;
        return Math.abs(numeric - Math.round(numeric)) < 1e-3 ? numeric.toFixed(0) : numeric.toFixed(2);
    };

    function clampRate(value) {
        return Math.min(MAX_RATE, Math.max(MIN_RATE, value));
    }

    function emitRateChange(rateValue) {
        if (Number.isNaN(rateValue)) {
            return;
        }
        const normalized = Number(rateValue.toFixed(2));
        dispatch('rateChange', {
            time: timeIndicator,
            rate: normalized
        });
    }

    function handleSliderInput(event) {
        const nextIndex = Number(event.target.value);
        if (Number.isNaN(nextIndex)) {
            return;
        }
        rateIndex = Math.max(0, Math.min(nextIndex, allowedRates.length - 1));
        const selectedRate = allowedRates[rateIndex] ?? 1;
        manualRate = formatRate(selectedRate);
        emitRateChange(selectedRate);
    }

    function handleManualInput(event) {
        manualRate = event.target.value;
    }

    function commitManualRate() {
        const numeric = Number(manualRate);
        if (Number.isNaN(numeric)) {
            manualRate = formatRate(currentRate);
            return;
        }
        const normalized = clampRate(numeric);
        if (!allowedRates.some((value) => isApproximatelyEqual(value, normalized))) {
            allowedRates = [...allowedRates, normalized].sort((a, b) => a - b);
        }
        rateIndex = allowedRates.findIndex((value) => isApproximatelyEqual(value, normalized));
        manualRate = formatRate(normalized);
        emitRateChange(normalized);
    }

    function handleTimeBlur() {
        dispatch('timeIndicatorChange', {
            time: timeIndicator,
            newTime: localTimeIndicator,
            type: 'speed'
        });
    }

    function deleteConfig() {
        dispatch('selectionDelete', { timeIndicator, type: 'speed' });
    }
</script>

<div class="flex flex-wrap items-center gap-3">
    <Label class="mt-4">Playback speed</Label>
    <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{formatRate(allowedRates[0] ?? MIN_RATE)}x</span>
            <input
                type="range"
                min="0"
                max={Math.max(allowedRates.length - 1, 0)}
                step="1"
                bind:value={rateIndex}
                on:input={handleSliderInput}
                class="w-48"
            />
            <span class="text-xs text-gray-500">{formatRate(allowedRates[allowedRates.length - 1] ?? MAX_RATE)}x</span>
        </div>
        <div class="flex flex-wrap gap-1 text-[10px] text-gray-500">
            {#each allowedRates as value, idx}
                <span class={idx === rateIndex ? 'font-semibold text-gray-700' : ''}>{formatRate(value)}x</span>
            {/each}
        </div>
    </div>
    <div class="flex items-center gap-2">
        <input
            type="number"
            min={MIN_RATE}
            max={MAX_RATE}
            step="0.05"
            bind:value={manualRate}
            on:input={handleManualInput}
            on:blur={commitManualRate}
            on:keydown={(event) => event.key === 'Enter' && (event.preventDefault(), commitManualRate())}
            class="mt-2 w-20 p-2 border rounded text-sm"
        />
        <span class="text-sm text-gray-500">x</span>
    </div>
    <span class="w-16 text-center text-sm text-gray-700">{formatRate(currentRate)}x</span>
    <Label class="mt-4">when reaction is at</Label>
    <input
        id="playback-time-indicator"
        type="text"
        class="mt-2 p-2 border rounded"
        bind:value={localTimeIndicator}
        on:blur={handleTimeBlur}
    />
    <Button on:click={deleteConfig} class="mt-2 bg-red-500 text-white p-2 rounded">Delete Config</Button>
</div>
