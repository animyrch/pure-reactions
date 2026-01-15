<script>
    import { createEventDispatcher, onMount } from "svelte";

    const dispatch = createEventDispatcher();

    let volumeInput = "0";

    onMount(() => {
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem(
                "pure-reactions-advanced-volume",
            );
            if (saved) {
                const num = parseFloat(saved);
                if (!Number.isNaN(num)) volumeInput = String(num);
            }
        }
    });

    const handleMirror = () => {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("pure-reactions-advanced-volume", volumeInput);
        }

        const volume = Math.round(
            Math.min(Math.max(Number.parseFloat(volumeInput) || 0, 0), 100),
        );

        dispatch("mirror", { volume });
    };
</script>

<div class="mt-1 flex flex-col gap-2 border-t border-border-subtle/50 pt-2">
    <label
        class="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        for="advanced-volume-input"
    >
        Mirror config
    </label>
    <div class="flex gap-2">
        <input
            id="advanced-volume-input"
            type="number"
            min="0"
            max="100"
            step="1"
            class="flex-1 rounded-md border border-border-strong/50 bg-surface/90 px-2 py-1 text-right text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
            bind:value={volumeInput}
            on:keydown|stopPropagation
            on:click|stopPropagation
        />
        <span class="self-center text-xs text-text-muted">%</span>
        <button
            type="button"
            class="rounded-md border border-accent-secondary/40 bg-accent-secondary/10 px-3 py-1 font-semibold text-accent-secondary transition hover:bg-accent-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/60"
            on:click|stopPropagation={handleMirror}
        >
            Mirror
        </button>
    </div>
</div>
