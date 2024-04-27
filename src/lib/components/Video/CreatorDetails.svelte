<script>
    import { List, Li } from 'flowbite-svelte';
    import VideoAuthor from '../VideoAuthor.svelte';

    export let originalVideoTitle;
    export let originalVideoAuthor;
    export let reactionVideoTitle;
    export let reactionVideoAuthor;
</script>

<List tag="ul" list="none" class="max-w-md divide-y divide-gray-200 dark:divide-gray-700">
    <Li class="pb-3 sm:pb-4">
        <div class="flex items-center space-x-4 rtl:space-x-reverse">
            <div class="flex-shrink-0">
                <p class="text-sm font-medium text-gray-900 truncate dark:text-white">Original Title:</p>
                <p class="text-sm font-medium text-gray-900 truncate dark:text-white">Original By:</p>
            </div>
            <div class="flex-1 min-w-0">
                {#if originalVideoTitle}
                     <p class="text-sm font-bold text-gray-800 truncate dark:text-white">{originalVideoTitle}</p>
                {/if}
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
                     <p class="text-sm font-bold text-gray-800 truncate dark:text-white">{reactionVideoTitle}</p>
                {/if}
                {#if reactionVideoAuthor}
                    <VideoAuthor
                        videoAuthor={reactionVideoAuthor}
                        isReactor
                        showLinks
                    />
                {/if}
            </div>
        </div>
    </Li>
</List>
