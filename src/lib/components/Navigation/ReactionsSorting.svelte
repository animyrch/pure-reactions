<script>
    import ReactionSortingOption from "$lib/components/Navigation/ReactionSortingOption.svelte";
    import { SORTINGS } from '$lib/constants/sortings';
    let currentSelection = SORTINGS.NEW;
    const setSorting = (newSorting) => {
        currentSelection = newSorting;
    }
</script>

<div class="w-full">
    <div class="grid max-w-xs grid-cols-2 gap-1 p-1 mx-auto my-2 bg-gray-100 rounded-lg dark:bg-gray-600" role="group">
        <ReactionSortingOption
            on:change={() => setSorting(SORTINGS.NEW)}
            isSelected={currentSelection === SORTINGS.NEW}
            sortText="New"
        />
        <!-- <button type="button" class="px-5 py-1.5 text-xs font-medium rounded-lg">
            Popular
        </button> -->
        <ReactionSortingOption
            on:change={() => setSorting(SORTINGS.FOLLOWING)}
            isSelected={currentSelection === SORTINGS.FOLLOWING}
            sortText="Following"
        />
    </div>
</div>
