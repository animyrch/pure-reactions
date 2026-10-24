<script>
  import ReactionsList from "$lib/components/ReactionsList.svelte";

  export let eyebrow;
  export let title = "";
  export let loading = false;
  export let items = [];
  export let empty = "";
  /** Bookmarks renders the list even when it is empty. Queues shows a message. */
  export let emptyMessage = true;
  export let sectionClass = "mb-10";
</script>

<div class={sectionClass}>
  <div class="mb-4">
    <p class="text-xs uppercase tracking-[0.35em] text-text-muted">{eyebrow}</p>
    {#if title}
      <h2 class="mt-1 text-lg font-semibold text-text-primary">{title}</h2>
    {/if}
  </div>
  {#if loading}
    <div>Loading...</div>
  {:else if items.length || !emptyMessage}
    <ReactionsList reactions={items} heading="" />
  {:else}
    <div class="text-sm text-text-muted">{empty}</div>
  {/if}
</div>
