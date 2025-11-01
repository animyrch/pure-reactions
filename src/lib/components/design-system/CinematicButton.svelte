<script>
  export let type = 'button';
  export let variant = 'primary';
  export let size = 'md';
  export let block = false;
  export let disabled = false;
  export let loading = false;
  export let ariaLabel;

  const baseClasses = 'inline-flex items-center justify-center gap-xs rounded-md font-medium transition-colors transition-transform duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60';

  const variantClasses = {
    primary: 'bg-accent-primary text-background hover:bg-primary-600 active:bg-primary-700 shadow-surface hover:shadow-elevated',
    secondary: 'bg-surface text-text-primary border border-border-strong hover:bg-elevated active:bg-elevated shadow-surface',
    muted: 'bg-transparent text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-strong',
    danger: 'bg-danger text-background hover:bg-[#e55b66] active:bg-[#d24f59] shadow-surface',
  };

  const sizeClasses = {
    sm: 'px-sm py-xs text-sm',
    md: 'px-md py-sm text-base',
    lg: 'px-lg py-sm text-lg',
  };

  const resolvedVariant = variantClasses[variant] ?? variantClasses.primary;
  const resolvedSize = sizeClasses[size] ?? sizeClasses.md;
</script>

<button
  type={type}
  class={`${baseClasses} ${resolvedVariant} ${resolvedSize} ${block ? 'w-full' : ''}`}
  disabled={disabled || loading}
  aria-label={ariaLabel}
  aria-busy={loading}
>
  {#if loading}
    <span class="relative flex items-center gap-xs" aria-hidden="true">
      <span class="h-[2px] w-8 overflow-hidden rounded-full bg-border-subtle">
        <span class="block h-full w-full animate-cross-dissolve bg-accent-primary" />
      </span>
      <slot name="loading">Loading…</slot>
    </span>
  {:else}
    <slot />
  {/if}
</button>
