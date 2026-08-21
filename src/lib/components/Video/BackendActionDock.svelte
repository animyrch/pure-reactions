<script>
    import { createEventDispatcher } from "svelte";

    export let actions = [];
    export let visible = false;

    const dispatch = createEventDispatcher();

    const handleDismiss = () => {
        dispatch("dismiss");
    };

    const handleDockInteractStart = () => {
        dispatch("dockinteractstart");
    };

    const handleDockInteractEnd = (event) => {
        if (
            event?.type === "focusout" &&
            event.currentTarget?.contains(event.relatedTarget)
        ) {
            return;
        }
        dispatch("dockinteractend");
    };
</script>

<div
    class={`pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
    }`}
    aria-hidden={!visible}
>
    <section
        class="pointer-events-auto w-full max-w-5xl rounded-2xl border border-slate-700/80 bg-slate-950/80 p-3 shadow-[0_30px_90px_-40px_rgba(15,23,42,1)] backdrop-blur-md sm:p-4"
        aria-label="Fullscreen action dock"
        on:mouseenter={handleDockInteractStart}
        on:mouseleave={handleDockInteractEnd}
        on:focusin={handleDockInteractStart}
        on:focusout={handleDockInteractEnd}
        on:touchstart={handleDockInteractStart}
        on:touchend={handleDockInteractEnd}
    >
        <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.26em] text-slate-400">
                Session Controls
            </p>
            <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                on:click={handleDismiss}
                aria-label="Hide control dock"
            >
                <svg
                    class="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                </svg>
                Hide
            </button>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each actions as action}
                <button
                    class={`group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                        action.active
                            ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-100"
                            : action.tone === "accent"
                              ? "border-blue-500/70 bg-blue-500/15 text-blue-100"
                              : "border-slate-700/80 bg-slate-900/70 text-slate-100"
                    } disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/30 disabled:text-slate-500`}
                    on:click={action.onClick}
                    disabled={action.disabled}
                    aria-busy={action.id === "start-reaction"
                        ? action.label === "Preparing Session..."
                        : undefined}
                    aria-keyshortcuts={action.shortcutAria}
                >
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950/70">
                        <svelte:component
                            this={action.icon}
                            class={`h-4 w-4 ${
                                action.active
                                    ? "text-emerald-300"
                                    : action.tone === "accent"
                                      ? "text-blue-300"
                                      : "text-slate-300"
                            }`}
                        />
                    </div>
                    <div class="flex min-w-0 flex-1 flex-col">
                        <div class="flex items-center justify-between gap-2">
                            <span class="truncate text-sm font-semibold leading-tight text-inherit">
                                {action.label}
                            </span>
                            {#if action.shortcutLabel}
                                <span
                                    class={`shrink-0 rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-300 ${
                                        action.disabled
                                            ? "opacity-40"
                                            : "opacity-100"
                                    }`}
                                    aria-hidden="true"
                                >
                                    {action.shortcutLabel}
                                </span>
                            {/if}
                        </div>
                        <span class="mt-0.5 line-clamp-2 text-xs text-slate-400">
                            {action.description}
                        </span>
                    </div>
                </button>
            {/each}
        </div>

        <p class="mt-3 text-[11px] text-slate-500">
            Press Esc to exit fullscreen while controls are hidden.
        </p>
    </section>
</div>
