<script>
  export let id;
  export let label;
  export let value = "0";
  /** Amount applied by the stepper buttons. The field still accepts typed decimals. */
  export let step = 1;
  export let min = 0;
  export let max = undefined;

  const formatValue = (numeric) => {
    const rounded = Math.round(numeric * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  const commit = (numeric) => {
    let next = numeric;
    if (next < min) next = min;
    if (typeof max === "number" && next > max) next = max;
    value = formatValue(next);
  };

  const bump = (direction) => {
    const parsed = Number.parseFloat(value);
    const base = Number.isFinite(parsed) ? parsed : 0;
    commit(base + direction * step);
  };

  const handleInput = (event) => {
    value = event.currentTarget.value;
  };
</script>

<div class="min-w-0">
  {#if label}
    <label class="mb-1 block text-[11px] font-medium text-text-muted" for={id}>
      {label}
    </label>
  {/if}
  <div
    class="flex h-9 overflow-hidden rounded-lg border border-border-subtle bg-background/80 focus-within:border-border-strong focus-within:ring-2 focus-within:ring-focus"
  >
    <input
      {id}
      class="spinless w-full min-w-0 bg-transparent px-2 text-sm text-text-primary outline-none"
      type="number"
      inputmode="decimal"
      step="any"
      {min}
      max={typeof max === "number" ? max : undefined}
      {value}
      aria-label={label || undefined}
      on:input={handleInput}
    />
    <div class="flex w-6 shrink-0 flex-col border-l border-border-subtle">
      <button
        type="button"
        class="flex flex-1 items-center justify-center text-text-muted hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        aria-label={`Increase ${label || "value"}`}
        on:click={() => bump(1)}
      >
        <svg class="h-2.5 w-2.5" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true">
          <path d="M6 0.8 11.2 7.2H0.8L6 0.8Z" />
        </svg>
      </button>
      <button
        type="button"
        class="flex flex-1 items-center justify-center border-t border-border-subtle text-text-muted hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        aria-label={`Decrease ${label || "value"}`}
        on:click={() => bump(-1)}
      >
        <svg class="h-2.5 w-2.5" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true">
          <path d="M6 7.2 0.8 0.8h10.4L6 7.2Z" />
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .spinless::-webkit-outer-spin-button,
  .spinless::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .spinless {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
