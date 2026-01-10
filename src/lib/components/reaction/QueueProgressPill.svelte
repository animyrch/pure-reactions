<script>
  export let queueSlug = null;
  export let queueTitle = null;
  export let index = 0;
  export let total = null;

  $: safeIndex = Number.isFinite(index) && index >= 0 ? index : 0;
  $: safeTotal = typeof total === 'number' && Number.isFinite(total) && total > 0 ? total : null;
  $: counter = safeTotal ? `${safeIndex + 1}/${safeTotal}` : `#${safeIndex + 1}`;
  $: label = safeTotal ? `${queueSlug} • ${safeIndex + 1}/${safeTotal}` : `${queueSlug} • #${safeIndex + 1}`;
  $: href = queueSlug ? `/queue/${queueSlug}` : null;
  $: titleText = queueTitle ? `${queueTitle} — ${label}` : label;
</script>

{#if queueSlug}
  <a class="pill" href={href} aria-label={titleText} title={titleText}>
    <span class="dot" aria-hidden="true" />
    <span class="text text-slug">{queueSlug}</span>
    <span class="text text-counter">• {counter}</span>
  </a>
{:else}
  <div class="pill" aria-label={titleText} title={titleText}>
    <span class="dot" aria-hidden="true" />
    <span class="text text-slug">{queueSlug || ''}</span>
    <span class="text text-counter">• {counter}</span>
  </div>
{/if}

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(10px);
    color: rgba(245, 247, 250, 0.92);
    text-decoration: none;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    max-width: 100%; /* Ensure it doesn't overflow parent */
  }

  a.pill {
    transition: transform 200ms ease, background 200ms ease, border-color 200ms ease;
  }

  a.pill:hover {
    transform: translateY(-1px);
    background: rgba(0, 0, 0, 0.46);
    border-color: rgba(255, 255, 255, 0.16);
  }

  a.pill:focus-visible {
    outline: 2px solid rgba(67, 217, 173, 0.55);
    outline-offset: 3px;
  }

  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: linear-gradient(135deg, rgba(67, 217, 173, 0.95), rgba(88, 112, 193, 0.85));
    box-shadow: 0 0 0 3px rgba(67, 217, 173, 0.12);
    flex-shrink: 0;
  }

  .text-slug {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .text-counter {
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>
