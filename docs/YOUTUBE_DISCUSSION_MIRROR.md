# YouTube Discussion Mirror

Read-only mirroring of YouTube top-level comments on reaction pages.

## Overview

Reaction pages can display a read-only "Discussion on YouTube" section for the reaction video, the original video, or both — depending on what is available on YouTube.

**Key principle:** Pure Reactions never hosts, stores, or moderates these comments. The feature is an honest preview with outbound links so users can continue the conversation on YouTube.

## Scope & Limits

| Aspect | Detail |
|--------|--------|
| Max comments per video | Set by `MAX_RESULTS_LIMIT` in `src/routes/api/youtube/comments/[videoId]/+server.js` |
| Ordering | YouTube relevance (not configurable) |
| Replies | Not fetched or rendered inline |
| In-site engagement | None — no upvote, like, reply, or comment creation inside Pure Reactions |
| Caching | Set by `CACHE_CONTROL_HEADER` in `src/routes/api/youtube/comments/[videoId]/+server.js` |
| SSR | Comments are **not** server-side rendered (client-side only) |

## Architecture

```
Browser (reaction page)
  └─ YouTubeDiscussion.svelte          ← container: resolves which sections to show
       └─ YouTubeDiscussionSection.svelte  ← renders one video's comments
            └─ fetch('/api/youtube/comments/:videoId')
                 └─ +server.js           ← server endpoint calling YouTube Data API
```

### Server endpoint

`src/routes/api/youtube/comments/[videoId]/+server.js`

- Calls YouTube `commentThreads` API with `part=snippet`, `order=relevance`, `maxResults=10`, `textFormat=plainText`.
- Normalizes the response into the UI-ready shape.
- Never exposes the YouTube API key to the browser.
- Returns structured `status` field: `ok`, `empty`, `commentsDisabled`, or `error`.
- Applies cache-control headers for CDN/edge caching via `CACHE_CONTROL_HEADER`.

### Client helper

`src/lib/helpers/youtubeComments.js`

- `fetchYouTubeComments(videoId)` — fetch wrapper that calls our server endpoint.
- `resolveDiscussionSections({ reactionVideoId, originalVideoId, originalVideoPlatform })` — determines which sections to render (handles deduplication, TikTok originals, missing IDs).
- `formatCommentAge(isoDate)` — relative time formatting.
- `formatLikeCount(count)` — compact number formatting.

### Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `YouTubeDiscussion.svelte` | `src/lib/components/Video/` | Resolves sections, renders one or two `YouTubeDiscussionSection` blocks |
| `YouTubeDiscussionSection.svelte` | `src/lib/components/Video/` | Fetches and renders comments for a single video, handles all load states |

## Responsive Layout

- On mobile and other narrow single-column layouts, discussion sections stack vertically.
- When the page has enough horizontal space, original and reaction discussion sections sit side by side, matching the original/reaction metadata split above.
- Comment cards inside each discussion section remain a vertical list; only the section wrapper changes responsively.

## Display Logic

| Reaction video | Original video | Sections shown |
|----------------|----------------|----------------|
| YouTube ID | YouTube ID (different) | Both (original + reaction) |
| YouTube ID | YouTube ID (same) | One (deduplicated) |
| YouTube ID | TikTok | Reaction only |
| YouTube ID | Missing | Reaction only |
| Missing | YouTube ID | Original only |
| Missing | TikTok | None |

## UI States

Each section handles:

- **Loading** — spinner + "Loading discussion…"
- **OK** — list of up to 10 comment cards
- **Empty** — "No top comments were returned for this video."
- **Comments disabled** — "Comments are turned off on YouTube for this video."
- **Error** — "Discussion is temporarily unavailable from YouTube."

## Outbound Actions

| Action | Scope | URL pattern |
|--------|-------|-------------|
| Comment on YouTube | Section-level | `https://www.youtube.com/watch?v={id}&lc=comments` |
| View thread on YouTube | Comment-level | `https://www.youtube.com/watch?v={id}&lc={commentId}` |

All links open in a new tab with `rel="noopener noreferrer"`.

## Caching Strategy

The server endpoint returns:

```
Cache-Control: public, s-maxage=86400, stale-while-revalidate=2592000
```

- 1 day fresh cache at CDN/edge
- 30 days stale reuse during background refresh
- No browser-to-YouTube direct calls
- No persistent storage of comments

### Future upgrade path

If quota or latency becomes an issue, add a short-lived cache in Firestore or KV store keyed by `videoId`.

## Accessibility

- Section uses `<section>` with descriptive `aria-label`.
- Comment list uses `role="list"`.
- All outbound links have meaningful `aria-label` attributes.
- All interactive elements are keyboard-focusable with visible focus rings.
- Loading state has `role="status"` and `aria-live="polite"`.

## Data Shape

The normalized comment payload from the server endpoint:

```json
{
  "status": "ok",
  "videoId": "abc123",
  "canonicalVideoUrl": "https://www.youtube.com/watch?v=abc123",
  "sectionActionUrl": "https://www.youtube.com/watch?v=abc123&lc=comments",
  "comments": [
    {
      "threadId": "...",
      "commentId": "...",
      "authorDisplayName": "...",
      "authorProfileUrl": "...",
      "authorAvatarUrl": "...",
      "textDisplay": "...",
      "publishedAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "likeCount": 42,
      "replyCount": 3,
      "viewThreadUrl": "https://www.youtube.com/watch?v=abc123&lc=..."
    }
  ]
}
```
