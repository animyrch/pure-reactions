<script>
    import { Label, Button } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';

    export let volume;
    export let timeIndicator = ''; // Declare a prop to receive the value from the parent

    let localTimeIndicator = timeIndicator; // Create a local variable

    $: localTimeIndicator = timeIndicator; // Update the local variable when the prop changes
    const dispatch = createEventDispatcher();

    function deleteConfig() {
      dispatch('selectionDelete', { timeIndicator, type: 'volume' }); // Dispatch an event to notify about the deletion
    }
    function handleBlur() {
        dispatch('timeIndicatorChange', {
            time: timeIndicator,
            newTime: localTimeIndicator,
            type: 'volume'
        });
    }
    function handleInput() {
        dispatch('volumeChange', {
            time: timeIndicator,
            volume
        });
    }
</script>

<div class="flex gap-3">
    <div class="flex w-96 gap-3">
        <Label for="sound-level-input" class="mt-4">Sound level is</Label>
        <input type="range" min="0" max="100" bind:value={volume} id="sound-level-input" class="shrink" on:change={handleInput} />
    </div>
    <Label for="timeIndicatorInput" class="mt-4">when reaction is at</Label>
    <input
        id="timeIndicatorInput"
        type="text"
        class="mt-2 p-2 border rounded"
        bind:value={localTimeIndicator}
        on:blur={handleBlur}
    />
    <Button on:click={() => deleteConfig()} class="mt-2 bg-red-500 text-white p-2 rounded">Delete Config</Button>
</div>