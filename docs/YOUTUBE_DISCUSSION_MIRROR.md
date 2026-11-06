# YouTube Discussion Mirror

Read-only mirroring of YouTube top-level comments on reaction pages.

## Overview

Reaction pages can display a read-only "Discussion on YouTube" section for the reaction video, the original video, or both — depending on what is available on YouTube.

**Key principle:** Pure Reactions does not run a comment system. It keeps a short-lived server-side preview of YouTube's top comments and links out to YouTube. Visitors cannot post, like, reply, or moderate here.

## Scope & Limits

| Aspect | Detail |
|--------|--------|
| Max comments per video | Set by `MAX_RESULTS_LIMIT` in `src/routes/api/youtube/comments/[videoId]/+server.js` |
| Ordering | YouTube relevance (not configurable) |
| Replies | Not fetched or rendered inline |
| In-site engagement | None — no upvote, like, reply, or comment creation inside Pure Reactions |
| Caching | Server-only `youtubeCommentCache` snapshot, then `Cache-Control: public, s-maxage=86400, stale-while-revalidate=2592000` on a successful preview |
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

- Reads one `youtubeCommentCache` document for the video id.
- Calls YouTube `commentThreads` with `part=snippet`, `order=relevance`, `maxResults=10`, `textFormat=plainText` only when that id is already on a published reaction and the snapshot is missing or stale.
- Normalizes the response into the UI-ready shape and stores at most ten plain-text comments.
- Never exposes the YouTube API key, and never returns the YouTube error body.
- Returns structured `status` field: `ok`, `empty`, `commentsDisabled`, or `error`.
- Applies `Cache-Control: public, s-maxage=86400, stale-while-revalidate=2592000` to a successful preview so the CDN can skip the function. Error and unknown-id responses use `no-store`.

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

Quota is spent once per distinct catalog video, not once per visitor.

1. The CDN may reuse a successful response for one day (`s-maxage=86400`) and refresh it in the background for 30 days.
2. On a CDN miss, the route reads `youtubeCommentCache/{videoId}`.
3. A fresh snapshot is returned as-is. `ok` stays fresh for one day. `empty` and `commentsDisabled` stay fresh for seven days. `error` stays fresh for ten minutes and is not cached by the CDN.
4. A missing or stale snapshot calls YouTube only if a published reaction already has that id as `reactionVideoId`, or as `originalVideoId` with a YouTube original. One lock is held so concurrent misses share one YouTube call.
5. An id that is not on a published reaction, including a draft, returns an empty preview, does not call YouTube, and is not written.

The collection is denied to every client SDK. The Admin SDK on the server bypasses Firestore security rules, which is why the route can still read and write it. The browser only calls `/api/youtube/comments/{videoId}`.

Without `YOUTUBE_API_KEY`, the route returns placeholder comments and does not touch Firestore. Without Firebase Admin, it returns an empty preview and does not call YouTube.

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
