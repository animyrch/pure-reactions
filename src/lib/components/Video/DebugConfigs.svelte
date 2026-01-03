<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let summary = {
    total: 0,
    volume: 0,
    player: 0,
    speed: 0,
    spanStart: null,
    spanEnd: null,
  };
  export let timelineEntries = [];
  export let typeMeta = {};
  export let formatSeconds = (value) => value;
  export let resolveStateLabel = (value) => value;
  export let formatPercent = (value) => value;
  export let formatRate = (value) => value;
  export let seekMin = 0;
  export let seekMax = Number.POSITIVE_INFINITY;

  const handleDeleteEntry = (entry) => {
    const timeInReaction = entry?.timeInReaction;
    if (!Number.isFinite(timeInReaction)) return;

    if (entry?.trackId === "reactionVolume") {
      dispatch("deleteReactionVolumeConfig", { timeInReaction });
      return;
    }

    if (entry?.type === "volume") {
      dispatch("deleteVolumeConfig", { timeInReaction });
      return;
    }

    if (entry?.type === "speed") {
      dispatch("deletePlaybackRateConfig", { timeInReaction });
      return;
    }

    dispatch("deletePlayerConfig", { timeInReaction });
  };

  $: isEntryActive = (entry) => {
    const t = entry?.timeInReaction;
    if (!Number.isFinite(t)) return false;
    return t >= seekMin && (Number.isFinite(seekMax) ? t <= seekMax : true);
  };
</script>

<div class="flex flex-col gap-6">
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div
      class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">
        Total events
      </p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">
        {summary.total}
      </p>
    </div>
    <div
      class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">
        Volume Events
      </p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">
        {summary.volume}
      </p>
    </div>
    <div
      class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">
        Playback Events
      </p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">
        {summary.player}
      </p>
    </div>
    <div
      class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">
        Speed Events
      </p>
      <p class="mt-2 text-2xl font-semibold text-text-primary">
        {summary.speed}
      </p>
    </div>
    <div
      class="rounded-xl border border-border-subtle bg-background/70 p-4 shadow-sm"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">
        Timeline span
      </p>
      <p class="mt-2 text-base font-semibold text-text-primary">
        {formatSeconds(summary.spanStart)} → {formatSeconds(summary.spanEnd)}
      </p>
    </div>
  </div>

  <div class="rounded-2xl border border-border-subtle/80 bg-surface/60">
    {#if timelineEntries.length}
      <ul class="divide-y divide-border-subtle/60">
        {#each timelineEntries as entry}
          <li
            class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div
              class={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 ${!isEntryActive(entry) ? "opacity-40 grayscale" : ""}`}
            >
              <span
                class={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${typeMeta[entry.type]?.badgeClass ?? "border border-border-subtle text-text-secondary"}`}
              >
                {#if !isEntryActive(entry)}Ignored{:else}{typeMeta[entry.type]
                    ?.label ?? "Event"}{/if}
              </span>
              <div>
                <p class="text-sm font-semibold text-text-primary">
                  Reaction at {formatSeconds(entry.timeInReaction)}
                </p>
                <p class="text-xs text-text-muted">
                  {#if entry.type === "volume"}
                    Sets {entry.trackId === "reactionVolume" ? "reaction" : "original"} audio to {formatPercent(
                      entry.volume,
                    )}.
                  {:else if entry.type === "player"}
                    Switches to {resolveStateLabel(
                      entry.state,
                    )}{entry.targetTime != null
                      ? ` at ${formatSeconds(entry.targetTime)} original`
                      : ""}.
                  {:else if entry.type === "speed"}
                    Adjusts playback speed to {formatRate(entry.rate)}.
                  {:else}
                    Event recorded.
                  {/if}
                </p>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex items-center justify-center self-start rounded-md px-2 py-1 text-xs font-medium text-text-muted transition hover:bg-surface/70 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 sm:self-auto"
              aria-label={`Delete event at ${formatSeconds(entry.timeInReaction)}`}
              on:click={() => handleDeleteEntry(entry)}
            >
              Delete
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="px-4 py-6 text-sm text-text-muted">
        No fine-tune events yet. Use the editor below to add precise cues.
      </div>
    {/if}
  </div>
</div>
