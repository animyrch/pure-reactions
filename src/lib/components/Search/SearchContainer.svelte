<script>
    import { onDestroy, onMount, tick } from 'svelte';
    import { CloseOutline as CloseIcon, SearchOutline as SearchIcon } from 'flowbite-svelte-icons';
    import { getSearchProvider, getSearchConfig, isValidQuery, normalizeQuery } from '$lib/services/search';

    export let ariaLabel = 'Search';
    export let indices;
    export let loadingMsg = 'Searching...';
    export let noResultMsg = (value) => `No results for '${value}'`;
    export let query = '';
    export let resultCounter = (hits) => (hits.length > 0 ? `Results: ${hits.length}` : '');

    let searchProvider;
    let searchConfig;
    let overlayOpen = false;
    let loading = false;
    let noResults = false;
    let results = [];
    let sections = [];
    let flatHits = [];
    let debounceTimeout;
    let searchInput;
    let activeIndex = -1;
    let resultRefs = [];
    let queryTooShort = false;

    if (!indices) {
        console.error('SearchContainer: indices is required');
    }

    $: _indices = Array.isArray(indices) ? Object.fromEntries(indices) : indices;

    onMount(() => {
        searchProvider = getSearchProvider();
        searchConfig = getSearchConfig();
        
        if (!searchProvider) {
            console.error('SearchContainer: Search provider not available. Check configuration.');
        }
    });

    onDestroy(() => {
        clearTimeout(debounceTimeout);
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleGlobalKeydown);
        }
    });

    $: if (typeof window !== 'undefined') {
        if (overlayOpen) {
            window.addEventListener('keydown', handleGlobalKeydown);
            tick().then(() => {
                searchInput?.focus();
                if (query) {
                    scheduleSearch();
                }
            });
        } else {
            window.removeEventListener('keydown', handleGlobalKeydown);
        }
    }

    $: {
        let counter = 0;
        sections = (results || []).map(({ index, hits }) => {
            const mapped = hits.map((hit) => ({ index, hit, globalIndex: counter++ }));
            const label = resultCounter(mapped.map((item) => item.hit));
            return { index, hits: mapped, label };
        });
        flatHits = sections.flatMap((section) => section.hits);
    }

    $: if (overlayOpen && flatHits.length && activeIndex === -1) {
        activeIndex = 0;
        focusActiveResult();
    }

    $: if (!flatHits.length && activeIndex !== -1) {
        activeIndex = -1;
    }

    function processHits(hits) {
        return hits.map((hit) => {
            for (const [key, val] of Object.entries(hit)) {
                if (key.endsWith('Orig')) continue;
                const processedVal = hit?._snippetResult?.[key]?.value || hit?._highlightResult?.[key]?.value;
                if (processedVal) {
                    hit[`${key}Orig`] = val;
                    hit[key] = processedVal;
                }
            }
            return hit;
        });
    }

    function openOverlay() {
        overlayOpen = true;
    }

    function closeOverlay() {
        overlayOpen = false;
        loading = false;
        noResults = false;
        results = [];
        sections = [];
        flatHits = [];
        activeIndex = -1;
        resultRefs = [];
        clearTimeout(debounceTimeout);
        query = '';
    }

    function handleGlobalKeydown(event) {
        if (!overlayOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeOverlay();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveHighlight(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveHighlight(-1);
        }
    }

    function moveHighlight(delta) {
        if (!flatHits.length) {
            return;
        }

        if (activeIndex === -1) {
            activeIndex = delta > 0 ? 0 : flatHits.length - 1;
        } else {
            activeIndex = (activeIndex + delta + flatHits.length) % flatHits.length;
        }

        focusActiveResult();
    }

    async function focusActiveResult() {
        await tick();
        const node = resultRefs[activeIndex];
        node?.focus();
    }

    function handleInput(event) {
        query = event.currentTarget.value;
        scheduleSearch();
    }

    function handleSubmit(event) {
        event.preventDefault();
        scheduleSearch(true);
    }

    function handleSearchHitFocus(event) {
        const { index } = event.detail;
        if (typeof index === 'number') {
            activeIndex = index;
        }
    }

    function handleSearchHitHighlight(event) {
        const { index } = event.detail;
        if (typeof index === 'number') {
            activeIndex = index;
        }
    }

    function handleSearchHitSelect() {
        closeOverlay();
    }

    function registerResult(index, node) {
        if (typeof index === 'number' && node) {
            resultRefs[index] = node;
        }
    }

    const formatIndexLabel = (indexName) =>
        indexName
            ?.replace(/[_-]+/g, ' ')
            ?.replace(/\b\w/g, (char) => char.toUpperCase()) ||
        'Results';

    function scheduleSearch(immediate = false) {
        clearTimeout(debounceTimeout);

        const normalized = normalizeQuery(query);
        
        // Clear results if query is empty
        if (!normalized) {
            loading = false;
            noResults = false;
            queryTooShort = false;
            results = [];
            sections = [];
            flatHits = [];
            activeIndex = -1;
            return;
        }

        // Check minimum query length
        if (!isValidQuery(normalized)) {
            loading = false;
            noResults = false;
            queryTooShort = true;
            results = [];
            sections = [];
            flatHits = [];
            activeIndex = -1;
            return;
        }

        queryTooShort = false;

        const run = async () => {
            if (!searchProvider || !searchProvider.isReady()) {
                console.error('SearchContainer: Search provider not ready');
                return;
            }
            
            loading = true;
            try {
                const queries = Object.keys(_indices).map((indexName) => ({
                    index: indexName,
                    query: normalized
                }));
                
                const searchResults = await searchProvider.multiSearch(queries);
                const processed = searchResults.map((result) => ({
                    hits: processHits(result.hits),
                    index: result.index
                }));
                
                results = processed;
                noResults = !processed.some(({ hits }) => hits.length);
            } catch (error) {
                console.error('Search failed', error);
                noResults = true;
            } finally {
                loading = false;
            }
        };

        if (immediate) {
            run();
        } else {
            const delay = searchConfig?.debounceDelay || 300;
            debounceTimeout = setTimeout(run, delay);
        }
    }
</script>

<div class="relative inline-flex">
    <button
        type="button"
        class={`search-trigger inline-flex items-center gap-2 rounded-full border border-border-strong/60 bg-surface/70 px-4 py-2 text-sm font-medium text-text-primary shadow-surface transition-all duration-300 ease-cinematic hover:bg-surface/90 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${overlayOpen ? 'scale-95 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        aria-label="Open search"
        aria-expanded={overlayOpen}
        aria-haspopup="dialog"
        on:click={openOverlay}
    >
        <SearchIcon class="h-5 w-5" aria-hidden="true" />
        <span class="hidden sm:inline">Search</span>
    </button>

    {#if overlayOpen}
        <div class="fixed inset-0 z-50">
            <button
                class="absolute inset-0 h-full w-full bg-scrim/70 backdrop-blur-sm"
                type="button"
                aria-hidden="true"
                tabindex="-1"
                on:click={closeOverlay}
            />
            <section
                id="global-search"
                class="relative mx-auto flex h-full w-full max-w-none flex-col overflow-hidden bg-background/95 text-text-primary transition-all duration-300 ease-cinematic sm:h-auto sm:max-w-5xl sm:rounded-3xl sm:border sm:border-border-strong/50 sm:bg-surface/95 sm:shadow-elevated"
                role="dialog"
                aria-modal="true"
            >
                <form class="border-b border-border-subtle/40 px-6 py-5 sm:px-8" on:submit={handleSubmit}>
                    <div class="flex items-center gap-4">
                        <SearchIcon class="h-6 w-6 text-text-secondary" aria-hidden="true" />
                        <input
                            class="flex-1 bg-transparent text-base font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
                            type="search"
                            bind:this={searchInput}
                            bind:value={query}
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                            aria-label={ariaLabel}
                            placeholder="Search reactions, reactors, or playlists"
                            on:input={handleInput}
                        />
                        {#if query}
                            <button
                                type="button"
                                class="text-sm uppercase tracking-wide text-text-secondary transition duration-subtle ease-cinematic hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                on:click={() => {
                                    query = '';
                                    loading = false;
                                    noResults = false;
                                    results = [];
                                    sections = [];
                                    flatHits = [];
                                    activeIndex = -1;
                                }}
                            >
                                Clear
                            </button>
                        {/if}
                        <button
                            type="button"
                            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-strong/50 text-text-primary transition duration-subtle ease-cinematic hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label="Close search"
                            on:click={closeOverlay}
                        >
                            <CloseIcon class="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </form>
                <div class="flex-1 overflow-y-auto px-6 pb-10 pt-6 sm:px-8">
                    {#if !query.trim()}
                        <div class="py-16 text-center text-sm text-text-secondary">
                            <p class="text-base font-medium text-text-primary">Start typing to discover new reactions.</p>
                            <p class="mt-2 text-sm text-text-secondary">Search by video title, creator, or playlist to stay in the flow.</p>
                        </div>
                    {:else if queryTooShort}
                        <div class="py-16 text-center text-sm text-text-secondary">
                            <p class="text-base font-medium text-text-primary">Keep typing...</p>
                            <p class="mt-2">Enter at least {searchConfig?.minQueryLength || 2} characters to search.</p>
                        </div>
                    {:else if loading}
                        <p class="py-12 text-center text-sm text-text-secondary">{loadingMsg}</p>
                    {:else if noResults}
                        <div class="py-16 text-center text-sm text-text-secondary">
                            <p class="text-base font-medium text-text-primary">No matches just yet.</p>
                            <p class="mt-2">{noResultMsg(query)}</p>
                        </div>
                    {:else if flatHits.length}
                        <div class="space-y-10">
                            {#each sections as section (section.index)}
                                {#if section.hits.length}
                                    <section class="space-y-4">
                                        <header class="flex items-center justify-between">
                                            <h2 class="text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">{formatIndexLabel(section.index)}</h2>
                                            {#if section.label}
                                                <span class="text-xs text-text-secondary" aria-live="polite">{section.label}</span>
                                            {/if}
                                        </header>
                                        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                            {#each section.hits as item (item.hit.objectID)}
                                                <svelte:component
                                                    this={_indices[section.index]}
                                                    hit={item.hit}
                                                    tabIndex={activeIndex === item.globalIndex ? 0 : -1}
                                                    active={activeIndex === item.globalIndex}
                                                    index={item.globalIndex}
                                                    register={(node) => registerResult(item.globalIndex, node)}
                                                    on:focus={handleSearchHitFocus}
                                                    on:highlight={handleSearchHitHighlight}
                                                    on:select={handleSearchHitSelect}
                                                />
                                            {/each}
                                        </div>
                                    </section>
                                {/if}
                            {/each}
                        </div>
                    {:else}
                        <p class="py-12 text-center text-sm text-text-secondary">Fine-tune your keywords for sharper results.</p>
                    {/if}
                </div>
            </section>
        </div>
    {/if}
</div>
