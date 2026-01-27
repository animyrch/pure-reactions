<script>
  import AttributionCreatorBadge from './AttributionCreatorBadge.svelte';
  import AttributionVerifiedBadge from './AttributionVerifiedBadge.svelte';

  export let primaryPrefix = '';
  export let primaryName = '';
  export let primaryHref = '';
  export let primaryLinkLabel = '';
  export let primaryLinkTarget = undefined;
  export let primaryLinkRel = undefined;
  export let isVerifiedCreator = false;
  export let isChannelVerified = false;
</script>

<div class="min-w-0 flex items-center gap-2 text-text-muted">
  <span class="shrink-0">{primaryPrefix}:</span>
  {#if primaryHref}
    <a
      class="max-w-[14rem] truncate text-text-primary transition hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-[20rem]"
      href={primaryHref}
      title={primaryName}
      aria-label={primaryLinkLabel}
      target={primaryLinkTarget}
      rel={primaryLinkRel}
    >
      {primaryName}
    </a>
  {:else}
    <span class="max-w-[14rem] truncate text-text-primary sm:max-w-[20rem]" title={primaryName}>
      {primaryName}
    </span>
  {/if}

  {#if isChannelVerified}
    <AttributionVerifiedBadge />
  {/if}

  <AttributionCreatorBadge isVerifiedCreator={isVerifiedCreator} />
</div>
