<script>
    import PersonalPage from "$lib/components/PersonalPage.svelte";
    import PersonalListSection from "$lib/components/PersonalListSection.svelte";
    import SEO from "$lib/components/SEO.svelte";
    import { userExtraDataStore } from "$lib/stores/userExtraData";
    import { isLoggedIn } from "$lib/stores/user";
    import { getAllReactions } from "$lib/helpers/firebase";
    import { SORTINGS } from "$lib/constants/sortings";

    let reactions = [];
    let isLoading = false;
    let loadedFollowKey = "";

    const loadReactions = async (follows) => {
        isLoading = true;
        reactions = [];
        const result = await getAllReactions(SORTINGS.FOLLOWING, follows);
        reactions = Array.isArray(result) ? result : [];
        isLoading = false;
    };

    $: follows = $userExtraDataStore.userExtraData?.follows;
    $: followKey = Array.isArray(follows) ? follows.join("\n") : "";
    $: if ($isLoggedIn && followKey && followKey !== loadedFollowKey && !isLoading) {
        loadedFollowKey = followKey;
        loadReactions(follows);
    } else if ($isLoggedIn && !followKey) {
        reactions = [];
        isLoading = false;
        loadedFollowKey = "";
    }
</script>

<SEO
    title="Reactors I Follow"
    description="Reactions from reactors you follow."
    canonical="/following"
    robots="noindex, follow"
/>

<PersonalPage>
    <PersonalListSection
        eyebrow="Following"
        title="Reactors you follow"
        loading={isLoading}
        items={reactions}
        empty="No reactions from reactors you follow yet."
    />
</PersonalPage>
