<script>
    import ReactionsList from '$lib/components/ReactionsList.svelte';

     export let data;
</script>

<div>
	<ReactionsList reactions={data.creatorPureReactions} />
</div>