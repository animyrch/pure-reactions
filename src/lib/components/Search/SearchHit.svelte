<script>
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";

    export let hit;

    const hitAdjustedAsReaction = {
        id: hit.objectID,
        data: {
            ...hit
        }
    };
  </script>
  

<div class="w-96">
    <ReactionsListElement reaction={hitAdjustedAsReaction} />
</div>