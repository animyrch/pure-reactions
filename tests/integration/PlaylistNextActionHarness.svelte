<script>
  import { useTwinPlayers } from "$lib/composables/useTwinPlayers";

  const { actions } = useTwinPlayers({
    data: { slug: "", userId: null },
  });
</script>

<span data-testid="playlist-next-action">{typeof actions.loadNextReactionInPlaylist}</span>
