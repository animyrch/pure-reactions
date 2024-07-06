<script>
    import ReactionsListElement from "$lib/components/ReactionsListElement.svelte";
    import { onMount } from "svelte";
    import { getReactionsToOriginalVideo } from '$lib/helpers/firebase';
    import { Heading, Secondary } from 'flowbite-svelte';
    export let originalVideoId;
    export let reactionVideoId;

    let otherReactions = [];

    onMount(() => {
        if (originalVideoId && reactionVideoId) {
            console.log(originalVideoId, reactionVideoId, 'ids');
            getReactionsToOriginalVideo(originalVideoId, reactionVideoId).then(reactions => {
                console.log(reactions, 'reactions');
                otherReactions = reactions;
            });
        }
    });
</script>

{#if otherReactions.length > 0}
    <div class="other-reactions">
        <div class="text-center">
        <Heading tag="h2" customSize="text-4xl font-extrabold">
            <Secondary class="ms-2">Other reactions to the same video</Secondary>
        </Heading>
        </div>
        <div class="w-auto max-w-96">
        {#each otherReactions as reaction, index (index)}
            <div key={reaction.id}>
            <ReactionsListElement {reaction} />
            </div>
        {/each}
        </div>
    </div>    
{/if}