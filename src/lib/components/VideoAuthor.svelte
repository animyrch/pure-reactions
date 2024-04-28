<script>
import { YoutubeSolid } from 'flowbite-svelte-icons';
    import PurePureactionsLogo from './PurePureactionsLogo.svelte';

export let videoAuthor;
export let isReactor = false;
export let showLinks = true;

const videoAuthorLink = isReactor ? `/reactor/${videoAuthor}` : `/creator/${videoAuthor}`;
const PureReactionsPageMessage = isReactor ? 'Show Reactor Page' : 'Show Creator Page';
</script>
<div class="flex gap-3 items-center">
    <p class="text-sm text-gray-500 truncate dark:text-gray-400">{videoAuthor}</p>
    {#if showLinks}
        <a target="_blank" href={`https://www.youtube.com/${videoAuthor}`} title="Show Youtube Page"><YoutubeSolid class="text-red-600"/></a>
        <a href={videoAuthorLink} title="{PureReactionsPageMessage}"><PurePureactionsLogo slim /></a>
    {/if}
</div>