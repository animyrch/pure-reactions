<script>
    import { Select, Label, Button } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';
  
    export let selected;
    export let originalVideoTime;
    export let timeIndicator = ''; // Declare a prop to receive the value from the parent

    let localTimeIndicator = timeIndicator; // Create a local variable
    let localTimeIndicatorForOriginal = originalVideoTime;

    $: localTimeIndicator = timeIndicator; // Update the local variable when the prop changes
    $: localTimeIndicatorForOriginal = originalVideoTime;

    let states = [
      { value: 1, name: 'Play original' },
      { value: 2, name: 'Pause original' },
    ];
    const dispatch = createEventDispatcher();
  
    // Dispatch an event when selection changes
    $: dispatch('selectionChange', { state: selected, timeIndicator, type: 'player' });
  
    // Function to delete the current configuration
    function deleteConfig() {
      dispatch('selectionDelete', { timeIndicator, type: 'player' }); // Dispatch an event to notify about the deletion
    }

    function handleBlur() {
      dispatch('timeIndicatorChange', {
        time: timeIndicator,
        newTime: localTimeIndicator,
        type: 'player'
      });
    }

    function handleBlurForOriginal() {
      dispatch('timeInOriginalChange', {
        time: timeIndicator,
        timeIndicator: localTimeIndicatorForOriginal,
        type: 'player'
      });
    };
  </script>
  
  <Select id="configIndividual" class="mt-2 w-40" bind:value={selected} placeholder="">
    {#each states as { value, name }}
      <option value={value}>{name}</option>
    {/each}
  </Select>
  <Label for="originalVideoIndicator" class="mt-4">{selected === 1 ? 'from' : 'at'}</Label>
  <input
    id="originalVideoIndicator"
    type="text"
    class="mt-2 p-2 border rounded"
    bind:value={originalVideoTime}
    on:blur={handleBlurForOriginal}
  />
  <Label for="timeIndicatorInput" class="mt-4">when reaction is at</Label>
  <input
    id="timeIndicatorInput"
    type="text"
    class="mt-2 p-2 border rounded"
    bind:value={localTimeIndicator}
    on:blur={handleBlur}
  />
  
  <Button on:click={() => deleteConfig()} class="mt-2 bg-red-500 text-white p-2 rounded">Delete Config</Button>
  