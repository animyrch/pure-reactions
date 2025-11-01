<script>
  import { createEventDispatcher } from 'svelte';

  export let id;
  export let label = '';
  export let type = 'text';
  export let name;
  export let value = '';
  export let placeholder = '';
  export let helperText = '';
  export let error = '';
  export let required = false;
  export let disabled = false;
  export let describedBy;

  const dispatch = createEventDispatcher();
  const generatedId = `input-${Math.random().toString(36).slice(2, 9)}`;
  const inputId = id ?? generatedId;

  $: helperId = helperText ? `${inputId}-helper` : undefined;
  $: errorId = error ? `${inputId}-error` : undefined;
  $: describedByIds = [describedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;

  const handleInput = (event) => {
    value = event.currentTarget.value;
    dispatch('input', value);
  };

  const handleChange = () => {
    dispatch('change', value);
  };
</script>

<div class="flex flex-col gap-xs text-text-primary">
  {#if label}
    <label class="text-sm font-medium text-text-secondary" for={inputId}>
      {label}
      {#if required}
        <span class="ml-1 text-xs uppercase tracking-wide text-danger">*</span>
      {/if}
    </label>
  {/if}

  <input
    id={inputId}
    class="w-full rounded-md border border-border-subtle bg-surface px-md py-sm text-text-primary placeholder:text-text-muted shadow-surface transition duration-subtle ease-cinematic focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background disabled:text-text-muted"
    type={type}
    name={name}
    value={value}
    placeholder={placeholder}
    required={required}
    disabled={disabled}
  aria-describedby={describedByIds}
  aria-invalid={error ? 'true' : undefined}
    on:input={handleInput}
    on:change={handleChange}
  {...$$restProps}
  />

  {#if helperText}
    <p id={helperId} class="text-xs text-text-muted">
      {helperText}
    </p>
  {/if}

  {#if error}
    <p id={errorId} class="text-xs text-danger">
      {error}
    </p>
  {/if}
</div>
