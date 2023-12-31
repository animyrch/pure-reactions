<script>
    import Warning from "./Warning.svelte";

    export let toast;
    const isWarning = toast.type == "warning";
</script>

{#if isWarning}
    <Warning {toast} />
{/if}
