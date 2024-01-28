<script>
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";

    export let reactions;
</script>
<div class="flex gap-8 flex-wrap justify-center">
    {#each reactions as reaction, index (index)}
    <div class="w-96">
        <ReactionsListElement {reaction} />
    </div>
    {/each}
</div>
