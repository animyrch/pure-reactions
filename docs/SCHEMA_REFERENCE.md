# Schema Reference

This document defines the canonical data schemas used across Pure Reactions for Firestore and Algolia. Use this as the single source of truth when implementing features to avoid schema mismatches.

---

## Firestore Collections

### `reactions` (COLLECTION_REACTION_BINOMES)

The main collection for reaction videos.

#### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reactionVideoId` | string | Yes | YouTube video ID of the reaction |
| `reactionVideoTitle` | string | Yes | Title of the reaction video |
| `reactionVideoAuthor` | string | No | YouTube channel handle for the reaction video (e.g., `@channel`) |
| `originalVideoId` | string | Yes | Platform-native ID of the original content (YouTube ID or TikTok video ID) |
| `originalVideoTitle` | string | Yes | Title of the original video |
| `originalVideoAuthor` | string | No | Platform-native creator handle for the original video |
| `originalVideoAuthorHandle` | string | No | Platform-native creator handle/unique ID for the original video |
| `originalVideoAuthorUrl` | string | No | Canonical profile URL for the original creator |
| `originalVideoDescription` | string | No | Normalized description or caption for the original video |
| `originalVideoThumbnailUrl` | string | No | Canonical thumbnail/poster URL for the original video |
| `originalVideoThumbnailWidth` | number | No | Thumbnail width when known |
| `originalVideoThumbnailHeight` | number | No | Thumbnail height when known |
| `originalVideoUrl` | string | No | Canonical public URL of the original video |
| `originalVideoProviderName` | string | No | Source platform display name (for example `YouTube`, `TikTok`) |
| `originalVideoProviderUrl` | string | No | Source platform base URL |
| `originalVideoPlatform` | string | No | Original platform identifier: `youtube` or `tiktok` (defaults to `youtube` when omitted) |
| `slug` | string | No | URL-friendly identifier (falls back to doc ID) |
| `isPublished` | boolean | Yes | Visibility status (true = public, false = draft/unlisted) |
| `createdAt` | Timestamp | Yes | Document creation timestamp |
| `updatedAt` | Timestamp | Yes | Last update timestamp |

#### Timeline & Playback Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timelines` | object/array | No | Synchronization timeline data (supports legacy object and new array formats) |
| `configs` | object | No | Playback configuration (volume, speed, pause points) |
| `overlayVisibilityTimeline` | array[object] | No | Unified overlay timeline snapshots. Each entry is `{ t: number, visible: boolean, primary: "original" \| "reaction" }`. Legacy entries may omit `primary` and are normalized using carry-forward + `fullscreenPrimaryVideo`. |
| `fullscreenPrimaryVideo` | string | No | Static overlay fallback primary video (`original` or `reaction`) used when no overlay cue exists and as default for first overlay cue. |
| `state` | string | No | Playback state for recording sessions |

#### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | array[string] | No | Categorization tags |
| `description` | string | No | Description or notes |
| `duration` | number | No | Video duration in seconds |
| `thumbnailUrl` | string | No | Custom thumbnail URL (if not using YouTube default) |

#### Enriched Metadata Fields

Optional enrichment payloads populated by the server-side metadata enrichment flow.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `youtube.meta` | object | No | Enriched metadata for the reaction video's YouTube source |
| `youtube.meta.videoId` | string | No | Canonical YouTube video ID for the reaction |
| `youtube.meta.title` | string | No | Enriched reaction title from YouTube |
| `youtube.meta.description` | string | No | Enriched reaction description from YouTube |
| `youtube.meta.thumbnail` | string | No | Best-fit YouTube thumbnail URL for the reaction |
| `youtube.meta.publishedAt` | string | No | ISO timestamp from the YouTube API |
| `youtube.meta.durationSeconds` | number | No | Reaction duration derived from YouTube ISO duration |
| `lastEnrichedAt` | Timestamp | No | Last time the reaction-side YouTube metadata was refreshed |
| `originalYoutube.meta` | object | No | Enriched metadata for the original video when the original platform is YouTube |
| `originalYoutube.meta.videoId` | string | No | Canonical YouTube video ID for the original |
| `originalYoutube.meta.title` | string | No | Enriched original title from YouTube |
| `originalYoutube.meta.description` | string | No | Enriched original description from YouTube |
| `originalYoutube.meta.thumbnail` | string | No | Best-fit YouTube thumbnail URL for the original |
| `originalYoutube.meta.publishedAt` | string | No | ISO timestamp from the YouTube API |
| `originalYoutube.meta.durationSeconds` | number | No | Original duration derived from YouTube ISO duration |
| `originalYoutube.lastEnrichedAt` | Timestamp | No | Last time the original-side YouTube metadata was refreshed |
| `originalTikTok.meta` | object | No | Enriched metadata for the original video when the original platform is TikTok |
| `originalTikTok.meta.videoId` | string | No | Canonical TikTok video ID for the original |
| `originalTikTok.meta.title` | string | No | Enriched TikTok caption/title for the original |
| `originalTikTok.meta.description` | string | No | Normalized TikTok description/caption text |
| `originalTikTok.meta.authorName` | string | No | Creator display name from TikTok oEmbed |
| `originalTikTok.meta.authorHandle` | string | No | Creator handle from TikTok oEmbed |
| `originalTikTok.meta.authorUrl` | string | No | Creator profile URL from TikTok oEmbed |
| `originalTikTok.meta.thumbnail` | string | No | Poster thumbnail URL from TikTok oEmbed |
| `originalTikTok.meta.thumbnailWidth` | number | No | Poster thumbnail width |
| `originalTikTok.meta.thumbnailHeight` | number | No | Poster thumbnail height |
| `originalTikTok.meta.providerName` | string | No | Source platform name (`TikTok`) |
| `originalTikTok.meta.providerUrl` | string | No | Source platform URL (`https://www.tiktok.com`) |
| `originalTikTok.meta.embedType` | string | No | Embed type returned by TikTok oEmbed |
| `originalTikTok.meta.embedHtml` | string | No | Raw embed HTML returned by TikTok oEmbed |
| `originalTikTok.meta.embedProductId` | string | No | TikTok embed product/video ID |
| `originalTikTok.meta.canonicalUrl` | string | No | Canonical TikTok video URL used for enrichment |
| `originalTikTok.lastEnrichedAt` | Timestamp | No | Last time the original-side TikTok metadata was refreshed |

**Platform note**: `originalYoutube.*` is only expected when the original content is on YouTube. `originalTikTok.*` is only expected when the original content is on TikTok. Both platforms should populate the normalized top-level `originalVideo*` fields above so the interface can stay platform-agnostic.

#### User & Ownership

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reactorId` | string | No | Reactor's Firebase Auth user ID |
| `reactorDisplayName` | string | No | Reactor's display name (from Auth profile) |

---

### `userData` (COLLECTION_USER_DATA)

User-specific data and preferences.

**Document ID:** Firebase Auth UID (`userId`)

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bookmarks` | array[string] | No | Array of reaction IDs bookmarked by user |
| `follows` | array[string] | No | Array of reactor user IDs the user follows |
| `displayName` | string | No | Optional display name (if stored in Firestore) |
| `email` | string | No | Optional email (if stored in Firestore) |
| `lastExportAt` | Timestamp | No | Last self-service export timestamp |
| `createdAt` | Timestamp | No | Optional creation timestamp |
| `updatedAt` | Timestamp | No | Optional last update timestamp |

**Note**: Core account profile data (email, display name) primarily lives in Firebase Authentication.

---

### `playlists` (COLLECTION_PLAYLISTS)

User-created playlists of reactions.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reactionBinomeIds` | array[string] | Yes | Array of reaction document IDs in playlist |
| `originalVideoIds` | array[string] | Yes | Legacy aligned array of original video IDs. New playlist docs keep it in sync with `sequenceItems` for backward compatibility. |
| `sequenceItems` | array[object] | No | Canonical ordered snapshot for playlist playback/recording. Preserves duplicates and mixed YouTube/TikTok sources. |
| `sequenceItems[].id` | string | No | Deterministic local item identifier for rendering and ordering |
| `sequenceItems[].sourceType` | string | No | Source descriptor: `youtube-video`, `youtube-playlist`, or `tiktok-video` |
| `sequenceItems[].sourceIndex` | number | No | Index of the user-entered source element that produced this item |
| `sequenceItems[].playlistItemIndex` | number/null | No | Index inside the expanded YouTube playlist source when applicable |
| `sequenceItems[].originalVideoId` | string | No | Platform-native original video ID for the sequence slot |
| `sequenceItems[].originalVideoPlatform` | string | No | `youtube` or `tiktok` |
| `sequenceItems[].originalVideoUrl` | string | No | Canonical original URL used by recorder/playback |
| `sequenceItems[].youtubePlaylistId` | string | No | Source YouTube playlist ID when the item came from an expanded playlist |
| `sequenceItems[].title` | string | No | Optional snapshot title for playlist UI |
| `sequenceItems[].channelTitle` | string | No | Optional snapshot creator/channel label for playlist UI |
| `sequenceItems[].thumbnailUrl` | string | No | Optional snapshot thumbnail for playlist UI |
| `userId` | string | Yes | Creator's user ID |
| `youtubePlaylistId` | string | No | Legacy reference to a source YouTube playlist when applicable |
| `title` | string | No | Optional playlist title (legacy) |
| `description` | string | No | Optional playlist description (legacy) |
| `slug` | string | No | URL-friendly identifier |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | No | Last update timestamp |

**Note**: Playlists do NOT have an `isPublished` field.
**Legacy**: Older playlists may store `reactions` instead of `reactionBinomeIds` and may omit `sequenceItems` entirely. New code should prefer `sequenceItems` when present and fall back to `originalVideoIds` only for legacy reads.

---

### `queues` (COLLECTION_QUEUES)

Temporary playback queues for sequential viewing.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Yes | Queue identifier (also used as document ID) |
| `title` | string | Yes | Queue title |
| `description` | string | No | Queue description |
| `items` | array[object] | Yes | Ordered queue items ({ type: 'reaction' | 'playlist', id: string }) |
| `ownerId` | string | Yes | Owner's user ID |
| `ownerName` | string | No | Owner display name |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | Yes | Last update timestamp |
| `expiresAt` | Timestamp | No | Optional expiration timestamp (if used) |

**Legacy**: Older queues may store `reactions`, `currentIndex`, or `autoplay`.

---

### `youtubeChannelClaims` (COLLECTION_YOUTUBE_CHANNEL_CLAIMS)

Manual verification claims for YouTube channels. Document IDs are deterministic: `{youtubeChannelId}__{userId}`.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | Firebase Auth user ID submitting the claim |
| `youtubeChannelId` | string | Yes | YouTube channel identifier being claimed (channel handle when ID is unavailable in V1) |
| `youtubeChannelUrl` | string | No | YouTube channel URL for reference |
| `verificationToken` | string | Yes | Token placed in the claimant's YouTube video description |
| `verificationVideoUrl` | string | Yes | Link to the verification video |
| `status` | string | Yes | `pending` \| `approved` \| `rejected` |
| `createdAt` | Timestamp | Yes | Claim creation timestamp |
| `expiresAt` | Timestamp | Yes | When the verification token expires |
| `reviewNotes` | string | No | Admin-only review notes |

---

### `youtubeChannelVerifications` (COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS)

Public verification state for YouTube channels. Document IDs are the channel identifier (handle in V1).

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | `approved` (future: other states) |
| `approvedAt` | Timestamp | No | When the claim was approved |
| `claimId` | string | No | Claim document ID that triggered verification |

## Algolia Index

### `reactions` Index (ALGOLIA_REACTIONS_INDEX)

Minimal, cost-optimized search index for reactions.

#### Indexed Fields

| Field | Type | Searchable | Retrievable | Description |
|-------|------|------------|-------------|-------------|
| `objectID` | string | No | Yes | Firestore document ID |
| `reactionVideoId` | string | No | Yes | YouTube video ID (reaction) |
| `reactionVideoTitle` | string | Yes | Yes | Title of reaction video (primary search field) |
| `originalVideoId` | string | No | Yes | YouTube video ID (original) |
| `originalVideoTitle` | string | Yes | Yes | Title of original video (secondary search field) |
| `playlistId` | string | No | Yes | Playlist document ID when the reaction belongs to a playlist, used to preserve playlist navigation semantics in search results |
| `reactionVideoAuthor` | string | Yes | Yes | Reactor's YouTube channel handle (tertiary search field) |
| `tags` | array[string] | Yes | Yes | Categorization tags (filterable) |
| `slug` | string | No | Yes | URL-friendly identifier |
| `createdAt` | number | No | Yes | Timestamp in milliseconds (for sorting) |
| `updatedAt` | number | No | Yes | Last update timestamp |

#### Searchable Attributes (in priority order)

1. `reactionVideoTitle` (highest priority)
2. `originalVideoTitle`
3. `reactionVideoAuthor`
4. `tags`

#### Attributes for Faceting

- `reactionVideoAuthor` (searchable facet)
- `tags` (searchable facet)

#### Custom Ranking

- `desc(createdAt)` - Most recent reactions ranked higher

#### Intentionally EXCLUDED from Index

To minimize cost and payload size:

- `timelines` - Large arrays, not needed for search
- `configs` - Playback settings, not searchable
- `description` - Long text, not indexed
- `thumbnailUrl` - Derivable from video IDs
- `state` - Recording session data, temporary
- `reactorId` / `reactorDisplayName` - Privacy, not needed for search
- `duration` - Derivable from YouTube API

`playlistId` is intentionally retained even though it is not searchable because shared card components use it to route playlist-backed reactions into the playlist playback experience.

#### Indexing Rules

- **Only `isPublished === true` reactions** are indexed
- Index updated on:
  - Reaction created and published
  - Reaction updated (if published)
  - Reaction unpublished (removed from index)

---

## Firebase Realtime Database

### Shared Sessions (`sharedSessions/{sessionId}`)

Real-time co-watching sessions.

#### Structure

```javascript
{
  hostId: string,           // User ID of session host
  reactionId: string,       // Current reaction being watched
  originalVideoId: string,  // Current original video ID
  originalVideoPlatform: string, // 'youtube' | 'tiktok'
  originalVideoUrl: string, // Canonical original video URL when known
  state: string,            // 'playing' | 'paused'
  currentTime: number,      // Playback position in seconds
  volume: number,           // Volume level (0-100)
  playbackRate: number,     // Playback speed (0.25-2.0)
  lastUpdated: timestamp,   // Server timestamp
  viewers: {                // Map of viewer IDs
    [userId]: {
      joinedAt: timestamp,
      displayName: string
    }
  }
}
```

---

## Common Patterns & Conventions

### Timestamps

- Use Firestore `serverTimestamp()` for `createdAt` and `updatedAt`
- Algolia stores timestamps as **milliseconds** (number)
- Realtime DB uses Firebase server timestamps

### Boolean Flags

- Use consistent naming: `isPublished`, `isPublic`, `isActive`, etc.
- Default to `false` when not specified
- **Important**: The app uses `isPublished` for visibility, NOT `isPublic`

### IDs & References

- Document IDs: Auto-generated by Firestore or custom slugs
- YouTube IDs: Always 11 characters (e.g., `dQw4w9WgXcQ`)
- TikTok video IDs: Numeric platform IDs, typically 15-20 digits
- User IDs: Firebase Auth UIDs
- Slugs: Lowercase, hyphenated, URL-safe strings

### Arrays vs Objects

- Modern fields use **arrays** (e.g., `tags`, `bookmarks`, `reactions`)
- Legacy timeline data may be in **object** format (support both)
- When adding new fields, prefer arrays for lists

### Visibility & Privacy

- Use `isPublished` to control visibility
- `isPublished: true` = public, searchable, indexed
- `isPublished: false` = draft/unlisted, not indexed (direct-link access allowed)
- Playlists and queues currently have no visibility flag (considered public if accessible)

---

## Migration Notes

### Timeline Format Evolution

**Legacy format** (object):
```javascript
timelines: {
  state: { /* ... */ },
  volume: { /* ... */ }
}
```

**Modern format** (array):
```javascript
timelines: [
  { t: 0, type: 'state', value: 'playing' },
  { t: 5.2, type: 'volume', value: 80 }
]
```

Helper functions in `lib/helpers/reaction.js` auto-detect and handle both formats.

---

## Validation Rules

### Required Field Combinations

**Minimum for a valid reaction:**
- `reactionVideoId` + `reactionVideoTitle`
- `originalVideoId` + `originalVideoTitle`
- `isPublished` (explicitly set)
- `createdAt` + `updatedAt`

**Minimum for Algolia indexing:**
- All of the above, plus:
- `isPublished === true`
- Valid `objectID` (Firestore doc ID)

---

## Usage Examples

### Querying Published Reactions (Firestore)

```javascript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore/lite';

const q = query(
  collection(db, 'reactions'),
  where('isPublished', '==', true),
  orderBy('createdAt', 'desc')
);
const snapshot = await getDocs(q);
```

### Searching Reactions (Algolia)

```javascript
import { getSearchProvider } from '$lib/services/search';

const provider = getSearchProvider();
const results = await provider.search('metal reaction', {
  index: 'reactions'
});
```

### Creating a Reaction (Firestore)

```javascript
import { collection, addDoc, serverTimestamp } from 'firebase/firestore/lite';

const docRef = await addDoc(collection(db, 'reactions'), {
  reactionVideoId: 'abc123',
  reactionVideoTitle: 'My Reaction',
  originalVideoId: 'xyz789',
  originalVideoTitle: 'Original Video',
  originalVideoPlatform: 'youtube',
  reactionVideoAuthor: '@mychannel',
  isPublished: false, // Start as draft
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});
```

---

## Anti-Patterns (Common Mistakes)

❌ **Don't use `isPublic`** - The field is `isPublished`

❌ **Don't index unpublished reactions** - Only `isPublished === true` should be in Algolia

❌ **Don't include large data in Algolia** - Keep `timelines`, `configs`, `description` out

❌ **Don't assume playlists have `isPublished`** - They don't have this field

❌ **Don't hardcode index names** - Use `ALGOLIA_REACTIONS_INDEX` constant

❌ **Don't forget timestamps** - Always set `createdAt` and `updatedAt`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.6 | 2026-04-22 | Documented unified overlay snapshot timeline schema (`overlayVisibilityTimeline` now stores `visible` + `primary`) and static `fullscreenPrimaryVideo` fallback semantics |
| 1.5 | 2026-04-18 | Added YouTube Discussion Mirror API response schema (`/api/youtube/comments/[videoId]`) — see `docs/YOUTUBE_DISCUSSION_MIRROR.md` |
| 1.4 | 2026-03-07 | Added ordered playlist `sequenceItems` snapshot schema for duplicate-safe mixed YouTube/TikTok recording and playback, plus legacy compatibility notes for `originalVideoIds` |
| 1.3 | 2026-03-07 | Added normalized original-video author/description/thumbnail/url fields, documented `originalTikTok` enrichment metadata, and extended shared-session schema with original platform/url |
| 1.2 | 2026-03-07 | Documented `originalVideoPlatform`, clarified cross-platform original IDs, and added optional `originalYoutube`/`youtube` enrichment metadata for reaction docs |
| 1.1 | 2026-01-30 | Updated user data, playlist, and queue fields; documented export timestamp |
| 1.0 | 2026-01-22 | Initial schema documentation |

---

## Maintenance

This schema reference should be updated whenever:
- New fields are added to Firestore collections
- Algolia index schema changes
- Field types or validation rules change
- New collections are created

**Maintainer**: Keep this doc in sync with actual implementation. Run schema validation tests after updates.
