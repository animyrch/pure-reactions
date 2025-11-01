<script>
    import ReactionAction from "$lib/components/ReactionAction.svelte";
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { currentUser } from '$lib/stores/user';
    import { BellOutline, BellSolid } from 'flowbite-svelte-icons';
    export let reactionCreator;
    export let follows;
    export let reactorId;

    $: isFollowing = follows?.includes(reactorId);
    $: actionLabel = isFollowing ? `Unfollow ${reactionCreator}` : `Follow the reactions of ${reactionCreator}`;
    $: tooltipLabel = isFollowing ? 'Unfollow' : 'Follow';

    const onFollowReactor = () => {
            userExtraDataStore.addFollow($userExtraDataStore.userExtraData, $currentUser?.uid, reactorId);
        };

    const onUnfollowReactor = () => {
        userExtraDataStore.removeFollow($userExtraDataStore.userExtraData, $currentUser?.uid, reactorId);
    };
</script>

{#if reactionCreator}
    <ReactionAction
        buttonText={actionLabel}
        tooltip={tooltipLabel}
        iconOnly={true}
        ariaLabel={actionLabel}
        pressed={isFollowing}
        on:change={isFollowing ? onUnfollowReactor : onFollowReactor}
    >
        {#if isFollowing}
            <BellSolid class="h-6 w-6 text-accent-primary transition-colors duration-subtle ease-cinematic group-hover:text-accent-primary" aria-hidden="true" />
        {:else}
            <BellOutline class="h-6 w-6 text-text-primary transition-colors duration-subtle ease-cinematic group-hover:text-accent-primary" aria-hidden="true" />
        {/if}
    </ReactionAction>
{/if}