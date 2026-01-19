<script>
    import { FILTERS, TYPE_FILTERS } from "$lib/constants/filters";
    import { page } from "$app/stores";
    import { goToRoute } from "$lib/helpers/routing";

    const setFilter = (filterType, value) => {
        const currentParams = new URLSearchParams($page.url.searchParams);
        currentParams.set(filterType, value);
        goToRoute(`?${currentParams.toString()}`);
    };

    $: publishedFilter = $page.url.searchParams.get("published") || FILTERS.ALL;
    $: typeFilter = $page.url.searchParams.get("type") || TYPE_FILTERS.ALL;
</script>

<div class="filters-container">
    <div class="filter-group">
        <label for="published-filter" class="filter-label">Status:</label>
        <select
            id="published-filter"
            value={publishedFilter}
            on:change={(e) => setFilter("published", e.target.value)}
            class="filter-select"
        >
            <option value={FILTERS.ALL}>All</option>
            <option value={FILTERS.PUBLISHED}>Published</option>
            <option value={FILTERS.UNPUBLISHED}>Unpublished</option>
        </select>
    </div>

    <div class="filter-group">
        <label for="type-filter" class="filter-label">Type:</label>
        <select
            id="type-filter"
            value={typeFilter}
            on:change={(e) => setFilter("type", e.target.value)}
            class="filter-select"
        >
            <option value={TYPE_FILTERS.ALL}>All</option>
            <option value={TYPE_FILTERS.REACTIONS_ONLY}>Reactions Only</option>
            <option value={TYPE_FILTERS.PLAYLISTS_ONLY}>Playlists Only</option>
        </select>
    </div>
</div>

<style>
    .filters-container {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding: 1rem;
        margin-bottom: 1rem;
        background: linear-gradient(135deg, rgba(20, 24, 32, 0.66), rgba(14, 16, 23, 0.88));
        border-radius: 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        box-shadow: 0 4px 12px rgba(5, 8, 12, 0.26);
    }

    .filter-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .filter-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.8);
        white-space: nowrap;
    }

    .filter-select {
        padding: 0.5rem 0.75rem;
        background: rgba(30, 35, 45, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.5rem;
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 140px;
    }

    .filter-select:hover {
        background: rgba(40, 45, 55, 0.9);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .filter-select:focus {
        outline: none;
        border-color: rgba(99, 102, 241, 0.6);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    @media (max-width: 640px) {
        .filters-container {
            flex-direction: column;
        }

        .filter-group {
            width: 100%;
        }

        .filter-select {
            flex: 1;
            min-width: 0;
        }
    }
</style>
