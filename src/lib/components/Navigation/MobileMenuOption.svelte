<script>
    import { goToRoute } from '$lib/helpers/routing';
    
    export let targetUrl;
    export let targetName;
</script>

<button
    on:click={() => goToRoute(targetUrl)}
    type="button"
    class="inline-flex flex-col items-center justify-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 group"
>
    <slot></slot>
    <span class="sr-only">{targetName}</span>
</button>