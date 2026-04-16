<script>
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { SearchOutline as SearchIcon } from 'flowbite-svelte-icons';
    import { getSearchProvider, normalizeQuery } from '$lib/services/search';
    import SearchHit from '$lib/components/Search/SearchHit.svelte';
    import SEO from '$lib/components/SEO.svelte';
    import { ALGOLIA_REACTIONS_INDEX } from '$lib/constants/algolia';

    const HITS_PER_PAGE = 12;
    const DEBOUNCE_DELAY = 1000;

    let searchProvider;
    let query = '';
    let searchInput;
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

    $: hasMore = currentPage < totalPages - 1;
    $: hasResults = results.length > 0;
    $: isSearchMode = query.trim().length > 0;

    // Attach IntersectionObserver reactively once sentinel is bound
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
        searchProvider = getSearchProvider();

        const urlQuery = $page.url.searchParams.get('q') || '';
        if (urlQuery) {
            query = urlQuery;
        }

        await loadResults(0);
        initialLoadDone = true;
    });

    onDestroy(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (observer) observer.disconnect();
    });

    function triggerSearch(newQuery) {
        if (newQuery) {
            goto(`/search?q=${encodeURIComponent(newQuery)}`, { replaceState: true });
        } else {
            goto('/search', { replaceState: true });
        }
        currentPage = 0;
        loadResults(0);
    }

    async function loadResults(pageNum) {
        if (!searchProvider || !searchProvider.isReady()) {
            console.error('Search provider not available');
            return;
        }

        if (pageNum === 0) {
            loading = true;
        } else {
            loadingMore = true;
        }

        try {
            const normalized = normalizeQuery(query);
            const searchResult = await searchProvider.search(normalized, {
                index: ALGOLIA_REACTIONS_INDEX,
                hitsPerPage: HITS_PER_PAGE,
                page: pageNum
            });

            if (pageNum === 0) {
                results = searchResult.hits || [];
            } else {
                results = [...results, ...(searchResult.hits || [])];
            }

            currentPage = searchResult.page;
            totalPages = searchResult.nbPages;
            totalHits = searchResult.nbHits;
        } catch (error) {
            console.error('Search failed:', error);
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

    function handleInput() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            triggerSearch(normalizeQuery(query));
        }, DEBOUNCE_DELAY);
    }

    function handleClear() {
        query = '';
        if (debounceTimer) clearTimeout(debounceTimer);
        triggerSearch('');
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (debounceTimer) clearTimeout(debounceTimer);
        triggerSearch(normalizeQuery(query));
    }
</script>

<SEO
    title={query ? `Search: ${query}` : 'Search Reactions'}
    description="Search for synchronized reaction videos by title, reactor, or tags on Pure Reactions."
    canonical="/search"
    keywords="search reactions, find reaction videos, pure reactions search"
    robots="noindex, follow"
/>

<div class="search-page-container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 class="sr-only">Search Reactions</h1>
    <!-- Search Input -->
    <div class="search-header mb-8">
        <form on:submit={handleSubmit} class="w-full">
            <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <SearchIcon class="h-5 w-5 text-text-secondary" />
                </div>
                <input
                    bind:this={searchInput}
                    bind:value={query}
                    on:input={handleInput}
                    type="search"
                    class="block w-full rounded-2xl border border-border-strong/50 bg-surface/80 py-4 pl-12 pr-16 text-base text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-background"
                    placeholder="Search reactions by title, reactor, or tags..."
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                />
                {#if query}
                    <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                        <button
                            type="button"
                            class="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                            on:click={handleClear}
                        >
                            Clear
                        </button>
                    </div>
                {/if}
            </div>
        </form>
    </div>

    <!-- Loading State (initial load only) -->
    {#if loading}
        <div class="flex items-center justify-center py-24">
            <div class="text-center">
                <div class="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-border-strong border-t-focus"></div>
                <p class="text-base text-text-secondary">{isSearchMode ? 'Searching...' : 'Loading reactions...'}</p>
            </div>
        </div>
    {:else if hasResults}
        <!-- Results -->
        <div class="results-section">
            <div class="mb-6">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                    {#if isSearchMode}
                        {totalHits} {totalHits === 1 ? 'Result' : 'Results'} for "{query}"
                    {:else}
                        Latest Reactions
                    {/if}
                </h2>
            </div>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {#each results as hit (hit.objectID)}
                    <SearchHit {hit} />
                {/each}
            </div>

            <!-- Loading more indicator -->
            {#if loadingMore}
                <div class="flex items-center justify-center py-8">
                    <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-focus"></div>
                </div>
            {/if}
        </div>
    {:else if initialLoadDone}
        <!-- Empty State (only after initial load completes) -->
        <div class="empty-state py-16 text-center">
            <SearchIcon class="mx-auto mb-4 h-16 w-16 text-text-muted/50" />
            {#if isSearchMode}
                <h2 class="mb-2 text-xl font-semibold text-text-primary">
                    No reactions found for "{query}"
                </h2>
                <p class="text-base text-text-secondary">
                    Try adjusting your search terms or clear the search to browse all reactions.
                </p>
            {:else}
                <h2 class="mb-2 text-xl font-semibold text-text-primary">
                    No reactions available
                </h2>
                <p class="text-base text-text-secondary">
                    Check back soon for new content.
                </p>
            {/if}
        </div>
    {/if}

    <!-- Infinite scroll sentinel (always rendered) -->
    <div bind:this={sentinel} class="h-px w-full" aria-hidden="true"></div>
</div>

<style>
    .search-page-container {
        min-height: calc(100vh - 200px);
    }
</style>
