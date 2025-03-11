<script>
    import PlaylistsListElement from "$lib/components/PlaylistsListElement.svelte";

    export let playlists;
</script>
<div class="flex gap-8 flex-wrap justify-center">
    {#each playlists as playlist, index (index)}
    <div class="w-96">
        <PlaylistsListElement {playlist} />
    </div>
    {/each}
</div>
