<script>
    export let currentTime = 0;
    export let duration = 0;
    export let seekMin = 0;
    export let seekMax = 0;
    export let disabled = false;
    export let compact = false;
    export let ariaLabel = "Seek original video";
    export let onInput = (_event) => {};
    export let onChange = (_event) => {};

    function formatTime(time) {
        const seconds = Number(time);
        if (!Number.isFinite(seconds) || seconds < 0) {
            return "0:00";
        }
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.floor(seconds % 60);
        return `${minutes}:${remainder < 10 ? "0" : ""}${remainder}`;
    }
</script>

<div class="flex flex-col">
    <div class="flex items-baseline justify-between">
        <span
            class={`text-xs uppercase tracking-[0.3em] ${
                compact ? "text-slate-400" : "text-slate-500"
            }`}>Scrub</span
        >
        <span class="font-mono text-sm tabular-nums text-slate-200"
            >{formatTime(currentTime)} / {formatTime(duration)}</span
        >
    </div>
    <div
        class={`flex items-center gap-3 ${compact ? "mt-2" : "mt-4"}`}
    >
        <span
            class={`${
                compact ? "block" : "hidden sm:block"
            } min-w-[32px] text-right font-mono text-xs tabular-nums text-slate-400`}
            >{formatTime(currentTime)}</span
        >
        <input
            type="range"
            min={seekMin}
            max={seekMax}
            step="0.1"
            value={currentTime}
            class="backend-scrubber-range w-full cursor-pointer"
            on:input={onInput}
            on:change={onChange}
            {disabled}
            aria-label={ariaLabel}
            data-testid="backend-scrubber"
        />
        <span
            class={`${
                compact ? "block" : "hidden sm:block"
            } min-w-[32px] font-mono text-xs tabular-nums text-slate-400`}
            >{formatTime(duration)}</span
        >
    </div>
</div>

<style lang="postcss">
    .backend-scrubber-range {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        height: 28px;
        touch-action: manipulation;
    }

    .backend-scrubber-range:focus {
        outline: none;
    }

    .backend-scrubber-range:focus-visible {
        outline: 2px solid rgb(96 165 250 / 0.7);
        outline-offset: 4px;
        border-radius: 999px;
    }

    .backend-scrubber-range::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 999px;
        background: rgba(100, 116, 139, 0.45);
    }

    .backend-scrubber-range::-moz-range-track {
        height: 4px;
        border-radius: 999px;
        background: rgba(100, 116, 139, 0.45);
    }

    .backend-scrubber-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 12px;
        width: 12px;
        margin-top: -4px;
        border-radius: 999px;
        border: 1px solid rgba(226, 232, 240, 0.5);
        background: rgb(226, 232, 240);
        transition: transform 0.1s ease;
    }

    .backend-scrubber-range::-moz-range-thumb {
        height: 12px;
        width: 12px;
        border: 1px solid rgba(226, 232, 240, 0.5);
        border-radius: 999px;
        background: rgb(226, 232, 240);
        transition: transform 0.1s ease;
    }

    .backend-scrubber-range:hover::-webkit-slider-thumb,
    .backend-scrubber-range:hover::-moz-range-thumb {
        transform: scale(1.08);
    }

    .backend-scrubber-range:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
</style>
