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
| `originalVideoId` | string | Yes | YouTube video ID of the original content |
| `originalVideoTitle` | string | Yes | Title of the original video |
| `channelName` | string | No | Name of the reactor's channel |
| `channelId` | string | No | YouTube channel ID of the reactor |
| `slug` | string | No | URL-friendly identifier (falls back to doc ID) |
| `isPublished` | boolean | Yes | Visibility status (true = public, false = draft) |
| `createdAt` | Timestamp | Yes | Document creation timestamp |
| `updatedAt` | Timestamp | Yes | Last update timestamp |

#### Timeline & Playback Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timelines` | object/array | No | Synchronization timeline data (supports legacy object and new array formats) |
| `configs` | object | No | Playback configuration (volume, speed, pause points) |
| `state` | string | No | Playback state for recording sessions |

#### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | array[string] | No | Categorization tags |
| `description` | string | No | Description or notes |
| `duration` | number | No | Video duration in seconds |
| `thumbnailUrl` | string | No | Custom thumbnail URL (if not using YouTube default) |

#### User & Ownership

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | No | Creator's user ID |
| `userName` | string | No | Creator's display name |

---

### `userData` (COLLECTION_USER_DATA)

User-specific data and preferences.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | Firebase Auth user ID |
| `displayName` | string | No | User's display name |
| `email` | string | No | User's email |
| `bookmarks` | array[string] | No | Array of reaction IDs bookmarked by user |
| `following` | array[string] | No | Array of channel IDs user follows |
| `createdAt` | Timestamp | Yes | Account creation timestamp |
| `updatedAt` | Timestamp | Yes | Last update timestamp |

---

### `playlists` (COLLECTION_PLAYLISTS)

User-created playlists of reactions.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Playlist title |
| `description` | string | No | Playlist description |
| `userId` | string | Yes | Creator's user ID |
| `reactions` | array[string] | Yes | Array of reaction IDs in playlist |
| `slug` | string | No | URL-friendly identifier |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `updatedAt` | Timestamp | Yes | Last update timestamp |

**Note**: Playlists do NOT have an `isPublished` field.

---

### `queues` (COLLECTION_QUEUES)

Temporary playback queues for sequential viewing.

#### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reactions` | array[string] | Yes | Array of reaction IDs in queue |
| `currentIndex` | number | No | Index of currently playing reaction |
| `autoplay` | boolean | No | Auto-advance to next reaction |
| `createdAt` | Timestamp | Yes | Creation timestamp |
| `expiresAt` | Timestamp | No | Optional expiration timestamp |

---

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
| `channelName` | string | Yes | Yes | Reactor's channel name (tertiary search field) |
| `channelId` | string | No | Yes | Reactor's channel ID |
| `tags` | array[string] | Yes | Yes | Categorization tags (filterable) |
| `slug` | string | No | Yes | URL-friendly identifier |
| `createdAt` | number | No | Yes | Timestamp in milliseconds (for sorting) |
| `updatedAt` | number | No | Yes | Last update timestamp |

#### Searchable Attributes (in priority order)

1. `reactionVideoTitle` (highest priority)
2. `originalVideoTitle`
3. `channelName`
4. `tags`

#### Attributes for Faceting

- `channelName` (searchable facet)
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
- `userId` / `userName` - Privacy, not needed for search
- `duration` - Derivable from YouTube API

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
- User IDs: Firebase Auth UIDs
- Slugs: Lowercase, hyphenated, URL-safe strings

### Arrays vs Objects

- Modern fields use **arrays** (e.g., `tags`, `bookmarks`, `reactions`)
- Legacy timeline data may be in **object** format (support both)
- When adding new fields, prefer arrays for lists

### Visibility & Privacy

- Use `isPublished` to control visibility
- `isPublished: true` = public, searchable, indexed
- `isPublished: false` = draft, private, not indexed
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
  channelName: 'My Channel',
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
| 1.0 | 2026-01-22 | Initial schema documentation |

---

## Maintenance

This schema reference should be updated whenever:
- New fields are added to Firestore collections
- Algolia index schema changes
- Field types or validation rules change
- New collections are created

**Maintainer**: Keep this doc in sync with actual implementation. Run schema validation tests after updates.
