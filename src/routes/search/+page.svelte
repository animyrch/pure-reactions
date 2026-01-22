<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { SearchOutline as SearchIcon } from 'flowbite-svelte-icons';
    import { getSearchProvider, isValidQuery, normalizeQuery } from '$lib/services/search';
    import SearchHit from '$lib/components/Search/SearchHit.svelte';
    import { ALGOLIA_REACTIONS_INDEX } from '$lib/constants/algolia';
    import { COLLECTION_REACTION_BINOMES, db } from '$lib/constants/firebase';
    import { collection, getDocs, query as firestoreQuery, where, orderBy, limit } from 'firebase/firestore/lite';

    let searchProvider;
    let query = '';
    let searchInput;
    let loading = false;
    let results = [];
    let fallbackReactions = [];

    $: urlQuery = $page.url.searchParams.get('q') || '';

    // Sync query with URL on mount and URL changes (only when URL changes, not when user types)
    let lastUrlQuery = '';
    $: {
        if (urlQuery !== lastUrlQuery) {
            lastUrlQuery = urlQuery;
            query = urlQuery;
            if (query && searchProvider) {
                performSearch();
            }
        }
    }

    onMount(async () => {
        searchProvider = getSearchProvider();
        
        if (urlQuery) {
            performSearch();
        }

        // Load fallback reactions
        loadFallbackReactions();
    });

    async function loadFallbackReactions() {
        try {
            const reactionsRef = collection(db, COLLECTION_REACTION_BINOMES);
            const q = firestoreQuery(
                reactionsRef,
                where('isPublished', '==', true),
                orderBy('createdAt', 'desc'),
                limit(6)
            );
            const snapshot = await getDocs(q);
            fallbackReactions = snapshot.docs.map(doc => ({
                id: doc.id,
                data: doc.data()
            }));
        } catch (error) {
            console.error('Failed to load fallback reactions:', error);
            fallbackReactions = [];
        }
    }

    async function performSearch() {
        const normalized = normalizeQuery(query);

        if (!normalized || !isValidQuery(normalized)) {
            results = [];
            loading = false;
            return;
        }

        if (!searchProvider || !searchProvider.isReady()) {
            console.error('Search provider not available');
            return;
        }

        loading = true;
        try {
            const searchResult = await searchProvider.search(normalized, {
                index: ALGOLIA_REACTIONS_INDEX
            });
            results = searchResult.hits || [];
        } catch (error) {
            console.error('Search failed:', error);
            results = [];
        } finally {
            loading = false;
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        const normalized = normalizeQuery(query);
        
        if (!normalized || !isValidQuery(normalized)) {
            return;
        }

        // Update URL and trigger search
        goto(`/search?q=${encodeURIComponent(normalized)}`, { replaceState: false });
    }

    $: hasResults = results.length > 0;
    $: showEmptyState = !loading && query && !hasResults;
    $: showFallback = showEmptyState && fallbackReactions.length > 0;
</script>

<svelte:head>
    <title>{query ? `Search: ${query}` : 'Search'} - Pure Reactions</title>
</svelte:head>

<div class="search-page-container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                    type="search"
                    class="block w-full rounded-2xl border border-border-strong/50 bg-surface/80 py-4 pl-12 pr-4 text-base text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-background"
                    placeholder="Search reactions by title, reactor, or tags..."
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                />
                {#if query}
                    <button
                        type="button"
                        class="absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-medium text-text-secondary hover:text-text-primary"
                        on:click={() => {
                            query = '';
                            results = [];
                            goto('/search', { replaceState: true });
                        }}
                    >
                        Clear
                    </button>
                {/if}
            </div>
        </form>
    </div>

    <!-- Loading State -->
    {#if loading}
        <div class="flex items-center justify-center py-24">
            <div class="text-center">
                <div class="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-border-strong border-t-focus"></div>
                <p class="text-base text-text-secondary">Searching...</p>
            </div>
        </div>
    {:else if hasResults}
        <!-- Results -->
        <div class="results-section">
            <div class="mb-6">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                    {results.length} {results.length === 1 ? 'Result' : 'Results'} for "{query}"
                </h2>
            </div>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {#each results as hit (hit.objectID)}
                    <SearchHit {hit} />
                {/each}
            </div>
        </div>
    {:else if showEmptyState}
        <!-- Empty State -->
        <div class="empty-state py-16 text-center">
            <SearchIcon class="mx-auto mb-4 h-16 w-16 text-text-muted/50" />
            <h2 class="mb-2 text-xl font-semibold text-text-primary">
                No reactions found for "{query}"
            </h2>
            <p class="mb-8 text-base text-text-secondary">
                Try adjusting your search terms or browse recent reactions below.
            </p>

            {#if showFallback}
                <div class="fallback-content mt-12">
                    <h3 class="mb-6 text-lg font-semibold text-text-primary">
                        Recent Reactions
                    </h3>
                    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {#each fallbackReactions as reaction (reaction.id)}
                            <div class="fallback-item">
                                <a
                                    href="/reaction/{reaction.data.slug || reaction.id}"
                                    class="block overflow-hidden rounded-2xl border border-border-strong/30 bg-surface/50 transition-all duration-300 hover:border-border-strong hover:shadow-elevated"
                                >
                                    {#if reaction.data.reactionVideoId}
                                        <div class="aspect-video w-full overflow-hidden bg-elevated">
                                            <img
                                                src="https://i.ytimg.com/vi/{reaction.data.reactionVideoId}/mqdefault.jpg"
                                                alt={reaction.data.reactionVideoTitle || 'Reaction thumbnail'}
                                                class="h-full w-full object-cover"
                                            />
                                        </div>
                                    {/if}
                                    <div class="p-4">
                                        <h4 class="mb-1 line-clamp-2 text-sm font-semibold text-text-primary">
                                            {reaction.data.reactionVideoTitle || 'Untitled Reaction'}
                                        </h4>
                                        {#if reaction.data.channelName}
                                            <p class="text-xs text-text-secondary">
                                                {reaction.data.channelName}
                                            </p>
                                        {/if}
                                    </div>
                                </a>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {:else if !query}
        <!-- Initial State -->
        <div class="initial-state py-24 text-center">
            <SearchIcon class="mx-auto mb-6 h-20 w-20 text-text-muted/30" />
            <h2 class="mb-3 text-2xl font-bold text-text-primary">
                Search for Reactions
            </h2>
            <p class="text-base text-text-secondary">
                Enter a search term to discover reactions by title, reactor, or tags.
            </p>
        </div>
    {/if}
</div>

<style>
    .search-page-container {
        min-height: calc(100vh - 200px);
    }
</style>