<script>
  export let type = 'button';
  export let variant = 'primary';
  export let size = 'md';
  export let block = false;
  export let disabled = false;
  export let loading = false;
  export let ariaLabel;
  export let tone = 'accent';

  const baseClasses = 'inline-flex items-center justify-center gap-xs rounded-md font-medium transition-colors transition-transform duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60';

  const variantClasses = {
    primary: {
      accent: 'bg-accent-primary text-background hover:bg-primary-600 active:bg-primary-700 shadow-surface hover:shadow-elevated',
      queue: 'bg-collection-queue text-background hover:bg-collection-queue/90 active:bg-collection-queue/80 shadow-surface hover:shadow-elevated',
      playlist: 'bg-collection-playlist text-background hover:bg-collection-playlist/90 active:bg-collection-playlist/80 shadow-surface hover:shadow-elevated',
      moment: 'bg-collection-moment text-background hover:bg-collection-moment/90 active:bg-collection-moment/80 shadow-surface hover:shadow-elevated',
      similar: 'bg-collection-similar text-background hover:bg-collection-similar/90 active:bg-collection-similar/80 shadow-surface hover:shadow-elevated',
    },
    secondary: 'bg-surface text-text-primary border border-border-strong hover:bg-elevated active:bg-elevated shadow-surface',
    muted: 'bg-transparent text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-strong',
    danger: 'bg-danger text-background hover:bg-[#e55b66] active:bg-[#d24f59] shadow-surface',
  };

  const sizeClasses = {
    sm: 'px-sm py-xs text-sm',
    md: 'px-md py-sm text-base',
    lg: 'px-lg py-sm text-lg',
  };

  const loadingToneClasses = {
    accent: 'bg-accent-primary',
    queue: 'bg-collection-queue',
    playlist: 'bg-collection-playlist',
    moment: 'bg-collection-moment',
    similar: 'bg-collection-similar',
  };

  $: resolvedVariant = variant === 'primary'
    ? (variantClasses.primary[tone] ?? variantClasses.primary.accent)
    : (variantClasses[variant] ?? variantClasses.primary.accent);
  const resolvedSize = sizeClasses[size] ?? sizeClasses.md;
  $: loadingTone = loadingToneClasses[tone] ?? loadingToneClasses.accent;
</script>

<button
  type={type}
  class={`${baseClasses} ${resolvedVariant} ${resolvedSize} ${block ? 'w-full' : ''}`}
  disabled={disabled || loading}
  aria-label={ariaLabel}
  aria-busy={loading}
  on:click
>
  {#if loading}
    <span class="relative flex items-center gap-xs" aria-hidden="true">
      <span class="h-[2px] w-8 overflow-hidden rounded-full bg-border-subtle">
        <span class={`block h-full w-full animate-cross-dissolve ${loadingTone}`} />
      </span>
      <slot name="loading">Loading…</slot>
    </span>
  {:else}
    <slot />
  {/if}
</button>
