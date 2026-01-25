<script>
  import ReactionsList from '$lib/components/ReactionsList.svelte';

  export let data;

  $: reactions = Array.isArray(data?.reactions) ? data.reactions : [];
  $: displayName =
    reactions?.[0]?.data?.reactorDisplayName ||
    reactions?.[0]?.data?.userName ||
    'Pure Reactions user';
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
  <header class="mb-8">
    <p class="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
      Pure Reactions profile
    </p>
    <h1 class="mt-3 text-2xl font-semibold text-text-primary sm:text-3xl">
      {displayName}
    </h1>
    <p class="mt-2 text-sm text-text-secondary">Public reactions synced by this user.</p>
  </header>

  {#if reactions.length}
    <ReactionsList reactions={reactions} />
  {:else}
    <div class="rounded-2xl border border-border-strong/30 bg-surface/50 p-6 text-sm text-text-muted">
      No published reactions yet.
    </div>
  {/if}
</div>
