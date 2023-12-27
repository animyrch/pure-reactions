<script>
	import { onMount } from 'svelte';
	import { getFilteredReactions } from '$lib/helpers/firebase';
    import ReactionsList from '$lib/components/ReactionsList.svelte';
    import { handlePrivateRoute } from '$lib/helpers/routing';
    
	// Initialize Firebase
	let reactions = [];

	// Call getReactions when the component is mounted
	onMount(async () => {
		reactions = await getFilteredReactions({
            userId: data.userId
        });
	});

    export let data;
</script>

{#if data.isLoggedIn}
    <div>
        <ReactionsList {reactions}/>
    </div>
{:else}{handlePrivateRoute()}{/if}