<script>
    import { DotsVerticalOutline } from 'flowbite-svelte-icons';
    import { Popover, Button } from 'flowbite-svelte';
    import BookmarkManagement from '../BookmarkManagement.svelte';

    export let reactionPageId;
    export let reactionVideoAuthor;
</script>

<div>
    <Button
        color="white"
        outline="true"
        id="{`offset-${reactionPageId}`}"
    >
        <DotsVerticalOutline size="md"/>
    </Button>
    <Popover class="w-42 text-sm font-light z-100" placement="left" triggeredBy="{`#offset-${reactionPageId}`}" trigger="click">
        <ul>
            <li class="flex items-center mb-1 z-100">
                <a target="_blank" href={`https://www.youtube.com/${reactionVideoAuthor}`}>Open Youtube Page</a>
            </li>
            <li class="flex items-center mb-1">
                <a href={`reactor/${reactionVideoAuthor}`}>Open Reactor Page</a>
            </li>
            <BookmarkManagement
                slug={reactionPageId}
                isText={true}
            />
        </ul>
    </Popover>
</div>