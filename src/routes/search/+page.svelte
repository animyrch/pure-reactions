<script>
    import Search from '$lib/components/Search/SearchContainer.svelte';
    import SearchHit from '$lib/components/Search/SearchHit.svelte';
    import { ALGOLIA_REACTIONS_INDEX } from '$lib/constants/algolia';

    const appId = 'NWC9ULFGSV';
    const searchKey = 'f0c46cab7149322771b6db4b87045577';
</script>

<div>
    <section class="relative">
        <Search
            {appId}
            {searchKey}
            indices={{ [ALGOLIA_REACTIONS_INDEX]: SearchHit }}
        />
    </section>
    <section class="results-section">
    </section>
</div>