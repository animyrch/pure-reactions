<script>
    import { Input, Button, Label } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';
    
    export let inputLabel;
    export let validateAction;
    export let validateCallToAction;
    export let inputId;
    export let value = '';

    // Create an event dispatcher
    const dispatch = createEventDispatcher();

    // Function to handle input changes
    function handleChange(event) {
        value = event.target.value;
        // Dispatch the 'input' event with the updated value
        dispatch('input', value);
    }
</script>

<div class="flex flex-col md:flex-row gap-2">
    <Label for={inputId} class="flex-none block mb-2 self-center">{inputLabel}</Label>
    <Input class="shrink" bind:value={value} on:input={handleChange} id={inputId} />
    <Button class="submit-button flex-none" on:click={validateAction}>{validateCallToAction}</Button>
</div>