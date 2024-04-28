<script>
    import ReactionAction from "$lib/components/ReactionAction.svelte";
    import FullBell from "$lib/icons/FullBell.svelte";
    import { Popover, Button } from 'flowbite-svelte';
    import EmptyBell from '$lib/icons/EmptyBell.svelte';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import { currentUser } from '$lib/stores/user';
    import {
      BellActiveAltSolid,
      BellActiveAltOutline,
      BellActiveOutline,
      BellActiveSolid,
      BellRingOutline,
      BellOutline,
      BellRingSolid,
      BellSolid
    } from 'flowbite-svelte-icons';
    export let reactionCreator;
    export let follows;
    export let reactorId;

    let placement;

    const onFollowReactor = () => {
            userExtraDataStore.addFollow($userExtraDataStore.userExtraData, $currentUser?.uid, reactorId);
        };

    const onUnfollowReactor = () => {
        userExtraDataStore.removeFollow($userExtraDataStore.userExtraData, $currentUser?.uid, reactorId);
    };
</script>

{#if follows?.includes(reactorId)}
    <div
        role="alert"
        class="inline h-4"
        id="follow-creator-button"
        data-popover-target="popover-bottom"
        data-popover-placement="bottom"
        on:mouseenter={() => (placement = 'bottom')}
    >
        <ReactionAction
            buttonText={`Unfollow ${reactionCreator}`}
        >
            <BellActiveAltSolid class="h-4 text-red-700"/>
        </ReactionAction>
        <Popover
            {placement} 
            class="w-40 text-sm font-light"
            triggeredBy="#follow-creator-button"
            trigger="click"
        >
            <Button
                on:click={onUnfollowReactor}
            >
                Confirm unfollow
            </Button>
        </Popover>
    </div>
{:else}
{#if reactionCreator}
    <ReactionAction
        buttonText={`Follow the reactions of ${reactionCreator}`}
        on:change={onFollowReactor}
    >
        <BellOutline class="h-4" />
    </ReactionAction>
    {/if}
{/if}