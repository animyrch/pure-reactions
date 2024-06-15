<script>
    import { List, Li } from 'flowbite-svelte';
    import VideoAuthor from '../VideoAuthor.svelte';
    import BookmarkManagement from '../BookmarkManagement.svelte';
    import { userExtraDataStore } from '$lib/stores/userExtraData';
    import FollowManagement from "$lib/components/FollowManagement.svelte";
    import RateVideo from '$lib/components/Video/RateVideo.svelte';

    export let originalVideoTitle;
    export let originalVideoAuthor;
    export let reactionVideoTitle;
    export let reactionVideoAuthor;
    export let reactorId;
    export let pageSlug;
    export let isUsersOwnVideo;
    export let reactionVideoId;
    export let originalVideoId;
</script>

<List tag="ul" list="none" class="max-w-lg divide-y divide-gray-200 dark:divide-gray-700">
    <Li class="pb-3 sm:pb-4">
        <div class="flex items-center space-x-4 rtl:space-x-reverse">
            <div class="flex-shrink-0">
                <p class="text-sm font-medium text-gray-900 truncate dark:text-white">Original Title:</p>
                <p class="text-sm font-medium text-gray-900 truncate dark:text-white">Original By:</p>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex gap-4">
                    {#if originalVideoTitle}
                        <p class="text-sm font-bold text-gray-800 truncate dark:text-white">
                            {originalVideoTitle}
                        </p>
                       <RateVideo
                           videoId={originalVideoId}
                       />
                    {/if}
                </div>
                {#if originalVideoAuthor}
                     <VideoAuthor
                        videoAuthor={originalVideoAuthor}
                        showLinks
                     />
                {/if}
            </div>
        </div>
    </Li>
    <Li class="py-3 sm:py-4">
        <div class="flex items-center space-x-4 rtl:space-x-reverse">
            <div class="flex-shrink-0">
                <p class="text-sm font-medium text-gray-900 truncate dark:text-white">Reaction Title:</p>
                <p class="text-sm font-medium text-gray-900 truncate dark:text-white">Reaction By:</p>
            </div>
            <div class="flex-1 min-w-0">
                {#if reactionVideoTitle}
                    <div class="flex items-center gap-4">
                        <p class="text-sm font-bold text-gray-800 truncate dark:text-white">{reactionVideoTitle}</p>
                        <RateVideo
                            videoId={reactionVideoId}
                        />
                        {#if $userExtraDataStore.userExtraData !== null && !isUsersOwnVideo}
                            <BookmarkManagement
                                slug={pageSlug}
                            />
                        {/if}
                    </div>
                {/if}
                {#if reactionVideoAuthor}
                <div class="flex gap-4">
                    <VideoAuthor
                        videoAuthor={reactionVideoAuthor}
                        isReactor
                        showLinks
                    />
                    {#if $userExtraDataStore.userExtraData !== null && !isUsersOwnVideo}
                        <FollowManagement
                            reactionCreator={reactionVideoAuthor}
                            {reactorId}
                            follows={$userExtraDataStore.userExtraData?.follows}
                        />
                    {/if}
                </div>
                {/if}
            </div>
        </div>
    </Li>
</List>
