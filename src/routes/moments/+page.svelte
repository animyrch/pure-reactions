<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { SearchOutline as SearchIcon, PlusOutline } from 'flowbite-svelte-icons';
  import SEO from '$lib/components/SEO.svelte';
  import MomentDiscoveryCard from '$lib/components/Moments/MomentDiscoveryCard.svelte';
  import { searchMoments } from '$lib/helpers/momentsSearch';
  import { DEFAULT_MOMENT_SORT, MOMENT_SORT_LABELS } from '$lib/constants/moments';

  const HITS_PER_PAGE = 12;
  const DEBOUNCE_DELAY = 600;

  let query = '';
  let sortBy = DEFAULT_MOMENT_SORT;
  let tagFilter = '';
  let loading = false;
  let loadingMore = false;
  let results = [];
  let currentPage = 0;
  let totalPages = 0;
  let totalHits = 0;
  let initialLoadDone = false;
  let debounceTimer;
  let sentinel;
  let observer;
  let lastFirestoreDoc = null;

  $: hasMore = currentPage < totalPages - 1;
  $: isSearchMode = query.trim().length > 0;

  $: if (sentinel && !observer) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
  }

  onMount(async () => {
    const url = $page.url.searchParams;
    query = url.get('q') || '';
    sortBy = url.get('sort') || DEFAULT_MOMENT_SORT;
    tagFilter = url.get('tag') || '';
    await loadResults(0);
    initialLoadDone = true;
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    observer?.disconnect();
  });

  function syncUrl() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (sortBy && sortBy !== DEFAULT_MOMENT_SORT) params.set('sort', sortBy);
    if (tagFilter.trim()) params.set('tag', tagFilter.trim());
    const suffix = params.toString();
    goto(suffix ? `/moments?${suffix}` : '/moments', { replaceState: true, keepFocus: true });
  }

  async function loadResults(pageNum) {
    if (pageNum === 0) {
      loading = true;
      lastFirestoreDoc = null;
    } else {
      loadingMore = true;
    }

    try {
      const searchResult = await searchMoments({
        query,
        page: pageNum,
        hitsPerPage: HITS_PER_PAGE,
        sortBy,
        tag: tagFilter,
        lastFirestoreDoc: pageNum === 0 ? null : lastFirestoreDoc
      });

      if (pageNum === 0) {
        results = searchResult.hits || [];
      } else {
        results = [...results, ...(searchResult.hits || [])];
      }

      currentPage = searchResult.page;
      totalPages = searchResult.nbPages;
      totalHits = searchResult.nbHits;
      lastFirestoreDoc = searchResult.lastFirestoreDoc;
    } catch (error) {
      console.error('Moments search failed:', error);
      if (pageNum === 0) results = [];
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  async function loadMore() {
    if (hasMore && !loadingMore) {
      await loadResults(currentPage + 1);
    }
  }

  function applyFilters() {
    syncUrl();
    loadResults(0);
  }

  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, DEBOUNCE_DELAY);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (debounceTimer) clearTimeout(debounceTimer);
    applyFilters();
  }

  function handleSortChange(event) {
    sortBy = event.currentTarget.value;
    applyFilters();
  }

  function handleTagChange(event) {
    tagFilter = event.currentTarget.value;
    applyFilters();
  }
</script>

<SEO
  title="Moments Discovery"
  description="Discover emotional moments in original videos and binge synchronized reactions."
  canonical="/moments"
  keywords="reaction moments, synchronized reactions, pure reactions moments"
/>

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 class="text-3xl font-semibold text-text-primary">Moments</h1>
      <p class="mt-2 max-w-2xl text-base text-text-secondary">
        Find a shared emotional beat in original content, then swipe through reactions synced to that exact moment.
      </p>
    </div>
    <a
      href="/moments/new"
      class="inline-flex items-center justify-center gap-2 rounded-md bg-accent-primary px-md py-sm text-base font-medium text-background shadow-surface transition hover:bg-primary-600"
    >
      <PlusOutline class="h-5 w-5" aria-hidden="true" />
      Create moment
    </a>
  </div>

  <form class="mb-6 space-y-4" on:submit={handleSubmit}>
    <div class="relative">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <SearchIcon class="h-5 w-5 text-text-secondary" aria-hidden="true" />
      </div>
      <input
        bind:value={query}
        on:input={handleInput}
        type="search"
        class="block w-full rounded-2xl border border-border-strong/50 bg-surface/80 py-4 pl-12 pr-4 text-base text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-background"
        placeholder="Search by moment title, original video, tags, or creator…"
        autocomplete="off"
      />
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label class="flex flex-col gap-1 text-sm text-text-secondary sm:flex-1">
        <span>Sort</span>
        <select
          class="rounded-xl border border-border-strong/50 bg-surface/80 px-3 py-2 text-text-primary"
          value={sortBy}
          on:change={handleSortChange}
        >
          {#each Object.entries(MOMENT_SORT_LABELS) as [value, label]}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm text-text-secondary sm:flex-1">
        <span>Tag filter</span>
        <input
          bind:value={tagFilter}
          on:change={handleTagChange}
          type="text"
          class="rounded-xl border border-border-strong/50 bg-surface/80 px-3 py-2 text-text-primary"
          placeholder="e.g. breakdown"
        />
      </label>
    </div>
  </form>

  {#if loading}
    <div class="flex justify-center py-24">
      <div class="h-12 w-12 animate-spin rounded-full border-4 border-border-strong border-t-focus"></div>
    </div>
  {:else if results.length}
    <p class="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
      {#if isSearchMode}
        {totalHits} {totalHits === 1 ? 'result' : 'results'}
      {:else}
        {totalHits || results.length} moments
      {/if}
    </p>
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each results as moment (moment.objectID || moment.id)}
        <MomentDiscoveryCard {moment} />
      {/each}
    </div>
    {#if loadingMore}
      <div class="flex justify-center py-8">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-focus"></div>
      </div>
    {/if}
  {:else if initialLoadDone}
    <div class="py-16 text-center text-text-secondary">
      <p class="text-lg font-medium text-text-primary">No moments yet</p>
      <p class="mt-2">Be the first to mark an emotional beat and invite reactions.</p>
      <div class="mt-6">
        <a
          href="/moments/new"
          class="inline-flex items-center justify-center rounded-md bg-accent-primary px-md py-sm text-base font-medium text-background"
        >
          Create a moment
        </a>
      </div>
    </div>
  {/if}

  <div bind:this={sentinel} class="h-px w-full" aria-hidden="true"></div>
</div>
