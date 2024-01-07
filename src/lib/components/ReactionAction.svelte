<script>
    import { createEventDispatcher } from 'svelte';

    export let buttonText;
    const dispatch = createEventDispatcher();
    const handleClick = () => {
        dispatch('change');
    }
</script>

<button
    on:click={handleClick}
>
    <div class="flex gap-1 content-center py-1">
    <span>{buttonText}</span>
    <slot></slot>
    </div>
</button>