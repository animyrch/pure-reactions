<script>
    import algoliasearch from 'algoliasearch/lite';
    import { onMount } from 'svelte';
    import { SearchOutline as SearchIcon } from 'flowbite-svelte-icons';
    import { Input, Button } from 'flowbite-svelte';

    export let appId;
    export let ariaLabel = `Search`;
    export let hasFocus = false;
    export let indices; // [indexName, component to render search results from that index]
    export let input = null;
    export let loadingMsg = `Searching...`;
    export let noResultMsg = (query) => `No results for '${query}'`;
    export let query = ``;
    export let resultCounter = (hits) => hits.length > 0 ? `<span>Results: ${hits.length}<span>` : ``;
    export let searchKey;

    let showResult = false;

    for (let [key, val] of Object.entries({ appId, searchKey, indices })) {
        if (!val)
            console.error(`svelte-algolia: Invalid ${key}: ${val}`);
    }
    $: _indices = Array.isArray(indices) ? Object.fromEntries(indices) : indices;
    let client;
    let promise;
    let noResults = false;

    onMount(() => (
        client = algoliasearch(appId, searchKey)
    ));

    function processHits(hits) {
        return hits.map((hit) => {
            for (const [key, val] of Object.entries(hit)) {
                if (key.endsWith(`Orig`))
                    continue;
                const processedVal = hit?._snippetResult?.[key]?.value || hit?._highlightResult?.[key]?.value;
                if (processedVal) {
                    hit[`${key}Orig`] = val;
                    hit[key] = processedVal;
                }
            }
            return hit;
        }
        );
    }

    async function search() {
        const { results } = await client.search(Object.keys(_indices).map((indexName) => ({ indexName, query })));
        const resultsProcessed = results.map(({ hits, index }) => ({ hits: processHits(hits), index }));
        noResults = !resultsProcessed[0].hits.length;
        showResult = true;
        return resultsProcessed;
    }
    function setSearchActive () {
        showResult = false;
        noResults = false;
    }
</script>
    

<aside>
     <form>
        <Input
            id="search"
            placeholder="Search a video or a reactor"
            size="lg"
            aria-label={ariaLabel}
            type="text"
            bind:this={input}
            bind:value={query}
            on:keyup={setSearchActive}
        >
            <SearchIcon slot="left" class="w-6 h-6 text-gray-500 dark:text-gray-400" />
            <Button
                slot="right"
                size="sm"
                type="submit"
                on:click={() => (promise = search())}
            >
                Search
            </Button>
        </Input>
        </form>
    {#if query}
        <div class="results">
            {#await promise}
                <p>{loadingMsg}</p>
            {:then allHits}
                {#if showResult && allHits?.some(({ hits }) => hits.length)}
                    {#each allHits as { index: idxName, hits } (idxName)}
                        {#if hits.length}
                            <section>
                                <h2>
                                    {@html resultCounter(hits)}
                                </h2>
                                <div class="flex gap-8 flex-wrap justify-center">
                                    {#each hits as hit (hit.objectID)}
                                        <svelte:component
                                            this={_indices[idxName]}
                                            {hit}
                                            on:close={() => (hasFocus = false)}
                                        />
                                    {/each}
                                </div>
                            </section>
                        {/if}
                    {/each}
                {/if}
                {#if noResults}
                    {noResultMsg(query)}
                {/if}
            {/await}
        </div>
    {/if}
</aside>
   