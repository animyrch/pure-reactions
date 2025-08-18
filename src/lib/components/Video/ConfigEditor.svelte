<script>
    import ConfigEditorInner from './ConfigEditorInner.svelte';
    import { Select, Label, Button } from 'flowbite-svelte';
    import { updateFirebaseDocument } from "$lib/helpers/firebase";
    
    export let volumeConfigs = {};
    export let playerConfigs = {};
    export let stateTimeline = [];
    export let volumeTimeline = [];

    const createSampleConfig = async () => {
        const newPlayerConfigs = {};
        newPlayerConfigs['0.00'] = { time: '0.00', state: 2 };
        await updateFirebaseDocument({
            "reactionConfigs": newPlayerConfigs
        });
        location.reload();
    };
</script>

<div>
    {#if (playerConfigs && Object.keys(playerConfigs).length > 0) || (stateTimeline && stateTimeline.length > 0)}
        <ConfigEditorInner
            {playerConfigs} {volumeConfigs}
        />
    {:else}
        <p>No configurations found</p>
        <Button on:click={createSampleConfig}>Create Sample Config</Button>
    {/if}
</div>