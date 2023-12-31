<script>
    import Warning from "./Warning.svelte";

    export let toast;
    export let key;
    const isWarning = toast.type == "warning";
</script>

{#if isWarning}
    <Warning {toast} {key} />
{/if}
