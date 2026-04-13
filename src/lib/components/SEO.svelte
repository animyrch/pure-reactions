<script>
  export let title = "Pure Reactions - Fair-Use-Free Reaction Videos";
  export let description = "Create and share reaction videos without copyright anxiety. PureReactions structurally separates original content from reactions, making your videos legally unclaimable.";
  export let canonical = "";
  export let type = "website";
  export let image = "/icon-512.png";
  export let keywords = "reaction videos, fair use, copyright free reactions, youtube reactions, video reactions, creator monetization";
  export let robots = "index, follow";
  
  const siteName = "Pure Reactions";
  const twitterHandle = "@purereactions";
  
  $: fullTitle = title.includes("Pure Reactions") ? title : `${title} | Pure Reactions`;
  $: fullCanonical = canonical ? `https://purereactions.com${canonical}` : "";
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  {#if keywords}
    <meta name="keywords" content={keywords} />
  {/if}
  {#if fullCanonical}
    <link rel="canonical" href={fullCanonical} />
  {/if}
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content={type} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:site_name" content={siteName} />
  {#if image}
    <meta property="og:image" content={image} />
  {/if}
  {#if fullCanonical}
    <meta property="og:url" content={fullCanonical} />
  {/if}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content={twitterHandle} />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  {#if image}
    <meta name="twitter:image" content={image} />
  {/if}
  
  <!-- Additional SEO -->
  <meta name="robots" content={robots} />
  <meta name="author" content="Pure Reactions" />
</svelte:head>
