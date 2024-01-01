<script>
    import { createEventDispatcher } from 'svelte';

    export let isSelected;
    export let sortText;

    const dispatch = createEventDispatcher();
    const handleClick = () => {
        dispatch('change');
    }
</script>

<button
    on:click={handleClick} 
    type="button"
    class={
        `px-5 py-1.5 text-xs font-medium rounded-lg
        ${isSelected ?
            'text-white bg-gray-900 dark:bg-gray-300 dark:text-gray-900' :
            'text-gray-900 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700'}`
    }
>
    {sortText}
</button>