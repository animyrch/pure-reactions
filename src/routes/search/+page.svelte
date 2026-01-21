<script>
    import Search from '$lib/components/Search/SearchContainer.svelte';
    import SearchHit from '$lib/components/Search/SearchHit.svelte';
    import { ALGOLIA_REACTIONS_INDEX } from '$lib/constants/algolia';
</script>

<div>
    <section class="relative">
        <Search
            indices={{ [ALGOLIA_REACTIONS_INDEX]: SearchHit }}
        />
    </section>
    <section class="results-section">
    </section>
</div>