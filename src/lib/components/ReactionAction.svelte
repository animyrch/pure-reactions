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
    <div title="{buttonText}" class="flex gap-1 content-center">
    <slot></slot>
    </div>
</button>