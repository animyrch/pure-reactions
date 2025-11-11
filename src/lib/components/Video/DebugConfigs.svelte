<script>
  export let summary = {
    total: 0,
    volume: 0,
    player: 0,
    speed: 0,
    spanStart: null,
    spanEnd: null
  };
  export let timelineEntries = [];
  export let typeMeta = {};
  export let formatSeconds = (value) => value;
  export let resolveStateLabel = (value) => value;
  export let formatPercent = (value) => value;
  export let formatRate = (value) => value;
</script>

<div class="flex flex-col gap-6">
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Total events</p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">{summary.total}</p>
    </div>
    <div class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Volume Events</p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">{summary.volume}</p>
    </div>
    <div class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Playback Events</p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">{summary.player}</p>
    </div>
    <div class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Speed Events</p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">{summary.speed}</p>
    </div>
    <div class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Timeline span</p>
      <p class="mt-2 text-base font-semibold text-text-primary">{formatSeconds(summary.spanStart)} → {formatSeconds(summary.spanEnd)}</p>
    </div>
  </div>

  <div class="rounded-2xl border border-border-subtle/80 bg-surface/60">
    {#if timelineEntries.length}
      <ul class="divide-y divide-border-subtle/60">
        {#each timelineEntries as entry}
          <li class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span class={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${typeMeta[entry.type]?.badgeClass ?? 'border border-border-subtle text-text-secondary'}`}>
                {typeMeta[entry.type]?.label ?? 'Event'}
              </span>
              <div>
                <p class="text-sm font-semibold text-text-primary">Reaction at {formatSeconds(entry.timeInReaction)}</p>
                <p class="text-xs text-text-muted">
                  {#if entry.type === 'volume'}
                    Sets original audio to {formatPercent(entry.volume)}.
                  {:else if entry.type === 'player'}
                    Switches to {resolveStateLabel(entry.state)}{entry.targetTime != null ? ` at ${formatSeconds(entry.targetTime)} original` : ''}.
                  {:else if entry.type === 'speed'}
                    Adjusts playback speed to {formatRate(entry.rate)}.
                  {:else}
                    Event recorded.
                  {/if}
                </p>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="px-4 py-6 text-sm text-text-muted">No fine-tune events yet. Use the editor below to add precise cues.</div>
    {/if}
  </div>
</div>
