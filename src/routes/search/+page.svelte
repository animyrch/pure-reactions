<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    onMount(() => {
        // Redirect away from the standalone search page — search lives in the header.
        goto('/', { replaceState: true });
    });
</script>

<div />