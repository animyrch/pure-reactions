<script>
    import { DotsVerticalOutline } from 'flowbite-svelte-icons';
    import { goto } from '$app/navigation';
    import { Popover, Button } from 'flowbite-svelte';
    import ReactionAction from '$lib/components/ReactionAction.svelte';
    import BookmarkManagement from '../BookmarkManagement.svelte';

    export let reactionPageId;
    export let reactionVideoAuthor;

    const handleOpenYoutubePage = () => {
        if (!reactionVideoAuthor || typeof window === 'undefined') return;
        window.open(`https://www.youtube.com/${reactionVideoAuthor}`, '_blank', 'noopener');
    };

    const handleOpenReactorPage = () => {
        if (!reactionVideoAuthor) return;
        goto(`/reactor/${reactionVideoAuthor}`);
    };
</script>

<div>
    <Button
        color="white"
        outline="true"
        id="{`offset-${reactionPageId}`}"
    >
        <DotsVerticalOutline size="md"/>
    </Button>
    <Popover class="w-auto text-sm font-medium text-text-primary z-50" placement="left" triggeredBy="{`#offset-${reactionPageId}`}" trigger="click">
        <ul class="flex flex-col gap-1 py-1">
            {#if reactionVideoAuthor}
                <li>
                    <ReactionAction
                        buttonText="Open Youtube Page"
                        className="w-full justify-start rounded-sm px-sm py-1 text-left hover:text-accent-primary focus-visible:ring-0 focus-visible:outline-none focus-visible:text-accent-primary"
                        on:change={handleOpenYoutubePage}
                    />
                </li>
                <li>
                    <ReactionAction
                        buttonText="Open Reactor Page"
                        className="w-full justify-start rounded-sm px-sm py-1 text-left hover:text-accent-primary focus-visible:ring-0 focus-visible:outline-none focus-visible:text-accent-primary"
                        on:change={handleOpenReactorPage}
                    />
                </li>
            {/if}
            <li>
                <BookmarkManagement
                    slug={reactionPageId}
                    isText={true}
                />
            </li>
        </ul>
    </Popover>
</div>