<script>
  /**
   * WalkalongClue — a show-once callout for first-time reactor guidance.
   *
   * Props:
   *   clueId      {string}   — unique ID (e.g. "react.paste-original")
   *   message     {string}   — one-sentence guidance shown to the user
   *   helpHref    {string=}  — optional "Learn more" URL
   *   seenClues   {string[]} — already-seen IDs (from userExtraDataStore)
   *   userId      {string=}  — current user ID (needed to persist dismissal)
   *
   * Events:
   *   dismiss     — fired after the user clicks "Got it"
   */
  import { createEventDispatcher, onMount } from 'svelte';

  export let clueId;
  export let message;
  export let helpHref = '';
  export let seenClues = [];
  export let userId = '';

  const dispatch = createEventDispatcher();

  // Stay hidden until the client cache is read so dismissed tips never flash on reload.
  let hydrated = false;
  let locallySeen = [];

  const readLocalSeen = () => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem('seenWalkalongClues') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const persistLocalSeen = (id) => {
    if (typeof localStorage === 'undefined' || !id) return;
    const next = readLocalSeen();
    if (!next.includes(id)) {
      next.push(id);
      localStorage.setItem('seenWalkalongClues', JSON.stringify(next));
    }
    locallySeen = next;
  };

  onMount(() => {
    locallySeen = readLocalSeen();
    hydrated = true;
  });

  $: visible =
    hydrated &&
    !(Array.isArray(seenClues) && seenClues.includes(clueId)) &&
    !locallySeen.includes(clueId);

  const dismiss = () => {
    persistLocalSeen(clueId);
    dispatch('dismiss', { clueId, userId });
  };
</script>

{#if visible}
  <aside
    class="walkalong-clue"
    role="note"
    aria-label="First-run tip"
    data-clue-id={clueId}
  >
    <div class="walkalong-clue__icon" aria-hidden="true">💡</div>
    <p class="walkalong-clue__message">{message}</p>
    <div class="walkalong-clue__actions">
      {#if helpHref}
        <a
          href={helpHref}
          class="walkalong-clue__link"
          target="_blank"
          rel="noopener noreferrer"
        >Learn more</a>
      {/if}
      <button
        type="button"
        class="walkalong-clue__dismiss"
        on:click={dismiss}
        aria-label="Dismiss tip"
      >Got it</button>
    </div>
  </aside>
{/if}

<style>
  .walkalong-clue {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background-color: color-mix(in srgb, #5cb2ff 12%, #15181f);
    border: 1px solid color-mix(in srgb, #5cb2ff 30%, transparent);
    color: #c7cbd7;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .walkalong-clue__icon {
    flex-shrink: 0;
    font-size: 1rem;
    margin-top: 0.05rem;
  }

  .walkalong-clue__message {
    flex: 1;
    margin: 0;
    color: #f5f7fa;
  }

  .walkalong-clue__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
    margin-left: 0.5rem;
  }

  .walkalong-clue__link {
    color: #5cb2ff;
    text-decoration: underline;
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .walkalong-clue__link:hover {
    color: #8aceff;
  }

  .walkalong-clue__dismiss {
    background: transparent;
    border: 1px solid #323845;
    border-radius: 0.375rem;
    color: #8d93a3;
    cursor: pointer;
    font-size: 0.8125rem;
    padding: 0.25rem 0.625rem;
    white-space: nowrap;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .walkalong-clue__dismiss:hover {
    border-color: #5cb2ff;
    color: #f5f7fa;
  }

  @media (prefers-reduced-motion: reduce) {
    .walkalong-clue__dismiss,
    .walkalong-clue__link {
      transition: none;
    }
  }
</style>
