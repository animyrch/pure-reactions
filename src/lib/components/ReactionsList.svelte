<script>
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";

    export let reactions;
</script>
<div>
    {#each reactions as reaction, index (index)}
        <ReactionsListElement {reaction} />
    {/each}
</div>
