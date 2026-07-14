<script>
    import ReactionThumbnail from "$lib/components/ReactionThumbnail.svelte";
  
	export let items = [];
	export let onPlaylistItemClick;
	export let getPlaylistItemVideoId;
	export let getPlaylistItemTitle;
	export let getPlaylistItemChannel;
</script>

<div class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
	{#each items as playlistItem, index (getPlaylistItemVideoId(playlistItem) || index)}
		<button
			type="button"
			class="block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			on:click={() => onPlaylistItemClick(index)}
			aria-label={`Start playlist from ${getPlaylistItemTitle(playlistItem)}`}
		>
			<div class="relative">
				<ReactionThumbnail
					originalVideoId={getPlaylistItemVideoId(playlistItem)}
					originalVideoTitle={getPlaylistItemTitle(playlistItem)}
					reactionVideoAuthor={getPlaylistItemChannel(playlistItem)}
					itemType="playlist"
					linkless
					showContextMenu={false}
				/>
				<div
					class="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-primary backdrop-blur"
				>
					#{index + 1}
				</div>
			</div>
		</button>
	{/each}
</div>
