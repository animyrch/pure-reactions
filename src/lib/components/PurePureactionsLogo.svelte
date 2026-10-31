<script>
    export let slim = false;
</script>

<!-- w-auto overrides the canvas width enhanced-img copies from the SVG.
     The full logo file is 1500px wide and otherwise stretches the header. -->
{#if slim}
    <enhanced:img src='$lib/public/pure-reactions-slim.svg' class="h-4 w-auto" alt="Pure Reactions" />
{:else}
    <enhanced:img src='$lib/public/pure-reactions.svg' class="h-8 w-auto" alt="Pure Reactions" />
{/if}
