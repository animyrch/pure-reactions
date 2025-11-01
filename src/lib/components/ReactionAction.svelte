<script>
    import { createEventDispatcher } from 'svelte';

    export let buttonText = '';
    export let iconOnly = false;
    export let tooltip;
    export let ariaLabel = '';
    export let pressed;
    export let disabled = false;
    export let className = '';

    const dispatch = createEventDispatcher();

    const handleClick = () => {
        if (disabled) {
            return;
        }

        dispatch('change');
    };

    $: label = ariaLabel || buttonText;
    $: tooltipCopy = tooltip || buttonText;
    $: showTooltip = iconOnly && tooltipCopy?.length;
    $: baseClasses = 'group relative inline-flex items-center justify-start rounded-sm transition-transform duration-subtle ease-cinematic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50';
    $: iconClasses = iconOnly
        ? 'h-10 w-10 rounded-full bg-surface text-text-primary hover:bg-elevated focus-visible:bg-elevated active:scale-[1.06]'
        : 'px-sm py-xs text-left text-background hover:text-accent-primary focus-visible:text-accent-primary dark:text-text-primary dark:hover:text-accent-primary';
    $: pressedClasses = pressed
        ? iconOnly
            ? 'text-accent-primary ring-1 ring-accent-primary/60'
            : 'text-accent-primary'
        : '';
    $: buttonClasses = [baseClasses, iconClasses, pressedClasses, className].filter(Boolean).join(' ');
</script>

<button
    type="button"
    class={buttonClasses}
    aria-label={iconOnly ? label : undefined}
    aria-pressed={pressed}
    data-pressed={pressed}
    disabled={disabled}
    on:click={handleClick}
>
    {#if iconOnly}
        <span class="sr-only">{label}</span>
        <span aria-hidden="true" class="flex h-6 w-6 items-center justify-center">
            <slot />
        </span>
        {#if showTooltip}
            <span class="pointer-events-none absolute -bottom-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-sm bg-overlay px-xs py-[2px] text-[0.65rem] uppercase tracking-wide text-text-primary opacity-0 transition duration-subtle ease-cinematic group-hover:opacity-100 group-focus-visible:opacity-100">
                {tooltipCopy}
            </span>
        {/if}
    {:else}
        <slot>{buttonText}</slot>
    {/if}
</button>