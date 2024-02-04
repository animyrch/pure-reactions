<script>
    import Search from '$lib/components/Search/SearchContainer.svelte';
    import SearchHit from '$lib/components/Search/SearchHit.svelte';

    const appId = 'NWC9ULFGSV';
    const searchKey = 'f0c46cab7149322771b6db4b87045577';
</script>

<div>
    <section class="relative">
        <Search
            {appId}
            {searchKey}
            indices={{ 'reactions-test': SearchHit }}
            placeholder="Search Pokedex"
        />
    </section>
    <section class="results-section">
    </section>
</div>