<script>
    import { SpeedDial } from 'flowbite-svelte';
    import { ShareNodesSolid, BookmarkSolid, HomeSolid, UserCircleSolid, SearchOutline } from 'flowbite-svelte-icons';
    import SpeedDialOption from '$lib/components/Navigation/SpeedDialOption.svelte';
	  import { page } from '$app/stores';
    import { copyToClipboard } from '$lib/helpers/system';

    const copyCurrentUrl = () => {
      console.log($page.url.href);
      copyToClipboard($page.url.href);
    };
</script>

<SpeedDial
    defaultClass="fixed end-6 bottom-6"
    pill={false}
    trigger="click"
    tooltip="none"
>
    <SpeedDialOption
        name="Share"
    >
      <ShareNodesSolid 
        on:click={copyCurrentUrl}
      />
    </SpeedDialOption>
    <SpeedDialOption
        name="Search"
        href="/search"
    >
      <SearchOutline />
    </SpeedDialOption>
    <SpeedDialOption
        name="Account"
        href="/account"
    >
      <UserCircleSolid />
    </SpeedDialOption>
    <SpeedDialOption
        name="Bookmarks"
        href="/bookmark"
    >
      <BookmarkSolid />
    </SpeedDialOption>
    <SpeedDialOption
        name="Home"
        href="/"
    >
      <HomeSolid />
    </SpeedDialOption>
  </SpeedDial>