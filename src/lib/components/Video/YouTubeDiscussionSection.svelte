<script>
  import { onMount } from 'svelte';
  import { fetchYouTubeComments, formatCommentAge, formatLikeCount } from '$lib/helpers/youtubeComments';
  import { YoutubeSolid } from 'flowbite-svelte-icons';

  /** @type {string} YouTube video ID */
  export let videoId;
  /** @type {'original' | 'reaction'} */
  export let sourceType = 'reaction';
  /** @type {string} Human-readable label like "Original Video" */
  export let sourceLabel = 'Video';

  /** @type {'idle' | 'loading' | 'ok' | 'empty' | 'commentsDisabled' | 'error'} */
  let loadState = 'idle';
  let comments = [];
  let sectionActionUrl = '';

  async function load() {
    if (!videoId) {
      loadState = 'error';
      return;
    }
    loadState = 'loading';
    try {
      const payload = await fetchYouTubeComments(videoId);
      comments = payload.comments || [];
      sectionActionUrl = payload.sectionActionUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      loadState = payload.status || (comments.length > 0 ? 'ok' : 'empty');
    } catch {
      loadState = 'error';
    }
  }

  onMount(() => {
    load();
  });

  // Re-fetch when videoId changes
  let prevVideoId = videoId;
  $: if (videoId !== prevVideoId) {
    prevVideoId = videoId;
    load();
  }
</script>

<section
  class="rounded-lg border border-border-subtle bg-surface p-4 sm:p-5"
  aria-label="Discussion on YouTube — {sourceLabel}"
  data-testid="youtube-discussion-{sourceType}"
>
  <!-- Header -->
  <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <div class="flex items-center gap-2">
      <YoutubeSolid class="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      <h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Discussion on YouTube
      </h3>
      <span class="text-xs text-text-muted">·</span>
      <span class="text-xs text-text-secondary">{sourceLabel}</span>
    </div>

    {#if loadState === 'ok' || loadState === 'empty'}
      <a
        href={sectionActionUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 text-xs font-medium text-accent-primary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Comment on YouTube for {sourceLabel}"
      >
        Comment on YouTube
        <span aria-hidden="true">↗</span>
      </a>
    {/if}
  </div>

  <!-- Loading state -->
  {#if loadState === 'loading' || loadState === 'idle'}
    <div class="flex items-center gap-2 py-6 text-sm text-text-muted" role="status" aria-live="polite">
      <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border-strong border-t-accent-primary" aria-hidden="true"></span>
      Loading discussion…
    </div>

  <!-- Comments disabled -->
  {:else if loadState === 'commentsDisabled'}
    <p class="py-4 text-sm text-text-muted">
      Comments are turned off on YouTube for this video.
    </p>

  <!-- No comments returned -->
  {:else if loadState === 'empty'}
    <p class="py-4 text-sm text-text-muted">
      No top comments were returned for this video.
    </p>

  <!-- Error -->
  {:else if loadState === 'error'}
    <p class="py-4 text-sm text-text-muted">
      Discussion is temporarily unavailable from YouTube.
    </p>

  <!-- Comments list -->
  {:else if loadState === 'ok'}
    <ul class="space-y-3" role="list" aria-label="YouTube comments for {sourceLabel}">
      {#each comments as comment (comment.commentId)}
        <li class="flex gap-3">
          <!-- Avatar -->
          {#if comment.authorAvatarUrl}
            <img
              src={comment.authorAvatarUrl}
              alt=""
              class="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
              loading="lazy"
              width="28"
              height="28"
            />
          {:else}
            <div class="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-elevated" aria-hidden="true"></div>
          {/if}

          <div class="min-w-0 flex-1">
            <!-- Author + timestamp -->
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {#if comment.authorProfileUrl}
                <a
                  href={comment.authorProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="truncate text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  {comment.authorDisplayName}
                </a>
              {:else}
                <span class="truncate text-xs font-medium text-text-secondary">
                  {comment.authorDisplayName}
                </span>
              {/if}
              {#if comment.publishedAt}
                <time
                  datetime={comment.publishedAt}
                  class="text-[0.625rem] text-text-muted"
                  title={new Date(comment.publishedAt).toLocaleString()}
                >
                  {formatCommentAge(comment.publishedAt)}
                </time>
              {/if}
            </div>

            <!-- Comment body -->
            <p class="mt-1 max-h-24 overflow-hidden text-sm leading-relaxed text-text-primary line-clamp-4">
              {comment.textDisplay}
            </p>

            <!-- Meta row: likes + outbound actions -->
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] text-text-muted">
              {#if comment.likeCount > 0}
                <span aria-label="{comment.likeCount} likes">
                  👍 {formatLikeCount(comment.likeCount)}
                </span>
              {/if}
              {#if comment.replyCount > 0}
                <span>
                  {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                </span>
              {/if}
              <a
                href={comment.replyOnYoutubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-accent-primary hover:text-text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="Reply on YouTube to comment by {comment.authorDisplayName}"
              >
                Reply on YouTube
              </a>
              <a
                href={comment.viewThreadUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-accent-primary hover:text-text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="View thread on YouTube for comment by {comment.authorDisplayName}"
              >
                View thread on YouTube
              </a>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
