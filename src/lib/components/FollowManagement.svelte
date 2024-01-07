<script>
    import ReactionAction from "$lib/components/ReactionAction.svelte";
    import FullBell from "$lib/icons/FullBell.svelte";
    import { Popover, Button } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';

    export let reactionCreator;

    const dispatch = createEventDispatcher();
    const handleClick = () => {
        dispatch('change');
    }
    let placement;
</script>
<div
    role="alert"
    class="inline"
    id="follow-creator-button"
    data-popover-target="popover-bottom"
    data-popover-placement="bottom"
    on:mouseenter={() => (placement = 'bottom')}
>
    <ReactionAction
        buttonText={`Unfollow ${reactionCreator}`}
    >
        <FullBell />
    </ReactionAction>
    <Popover
        {placement} 
        class="w-40 text-sm font-light"
        triggeredBy="#follow-creator-button"
        trigger="click"
    >
        <Button
            on:click={handleClick}
        >
            Confirm unfollow
        </Button>
    </Popover>
</div>