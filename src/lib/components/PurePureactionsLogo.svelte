<script>
    export let slim = false;
</script>

{#if slim}
    <enhanced:img src='$lib/public/pure-reactions-slim.svg' class="h-4" alt="Pure Reactions" />
{:else}
    <enhanced:img src='$lib/public/pure-reactions.svg' class="h-8" alt="Pure Reactions" />
{/if}