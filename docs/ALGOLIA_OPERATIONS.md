# Algolia Search Operations Guide

## Overview

This application uses Algolia for search functionality with a provider-agnostic abstraction layer that allows for easy migration to alternative search solutions like Meilisearch or Typesense.

## Architecture

### Abstraction Layer

All search functionality is accessed through a provider abstraction at `src/lib/services/search/`:

- **`SearchProvider.js`** - Base interface for all search providers
- **`AlgoliaSearchProvider.js`** - Algolia-specific implementation
- **`index.js`** - Factory and configuration management

This design ensures:
- No direct Algolia coupling in UI components
- Easy provider swapping with minimal refactor
- Consistent search API across the application

### Configuration

Search configuration is centralized in `src/lib/services/search/index.js`:

```javascript
const SEARCH_CONFIG = {
  minQueryLength: 2,        // Minimum characters to trigger search
  debounceDelay: 300,       // Debounce delay in ms
  defaultHitsPerPage: 20,   // Default results per page
  algolia: { ... }          // Provider-specific config
};
```

## Index Schema

The reactions index contains only essential, searchable fields to minimize cost:

### Indexed Fields
- `reactionVideoId` - Reaction video YouTube ID
- `reactionVideoTitle` - Title of reaction video
- `originalVideoId` - Original video YouTube ID
- `originalVideoTitle` - Title of original video
- `channelName` - Reactor's channel name
- `channelId` - Reactor's channel ID
- `tags` - Array of tags for filtering
- `slug` - URL-friendly identifier
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Intentionally Excluded
To minimize index size and cost:
- Timelines (large arrays)
- Transcripts (large text)
- Playback configs
- Thumbnails (derived from video IDs)
- Long descriptions

## Visibility policy

- **Only published reactions are indexed.** The indexing scripts and reindexing workflows query Firestore for documents where `isPublished === true` and will not push draft or private reactions to Algolia. If a different visibility field appears in legacy data, update those documents to set `isPublished` accordingly.

Add a short note in any reindexing run or automation that `isPublished` is the canonical field used to determine whether a reaction should be included in the index.

## Operations

### Check Index Status

```bash
npm run algolia:status
```

Reports on:
- Index health and record count
- Configured settings
- Sample record structure

### Reindex from Firestore

**Dry Run (recommended first):**
```bash
npm run algolia:index
```

**Apply Changes:**
```bash
npm run algolia:index:apply
```

**Clear and Reindex:**
```bash
npm run algolia:index:apply -- --clear
```

### Environment Variables

Required environment variables:

```bash
# Public (client-side)
PUBLIC_ALGOLIA_APP_ID=your_app_id
PUBLIC_ALGOLIA_SEARCH_API_KEY=your_search_key
PUBLIC_ALGOLIA_REACTIONS_INDEX=your_index_name

# Private (server-side/scripts only)
ALGOLIA_ADMIN_KEY=your_admin_key

# Firebase (for indexing)
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json
PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES=reactions
```

## Cost Management

### Current Optimizations

1. **Minimal Index Schema** - Only essential fields indexed
2. **Query Length Requirement** - Minimum 2 characters to search
3. **Debounced Input** - 300ms delay reduces search volume
4. **Explicit User Intent** - No automatic/background searches
5. **Efficient Retrieval** - Limited `attributesToRetrieve`

### Monitoring

Track these metrics regularly:

- **Search operations per month**
- **Records indexed**
- **Zero-result queries** (indicates poor index quality)
- **Average results per query**

### Migration Thresholds

Consider migrating if any threshold is exceeded:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Monthly cost | $50/month | Evaluate alternatives |
| Search volume | >100k queries/month | Consider self-hosted |
| Index size | >50k records | Evaluate pricing tier |
| Zero-result rate | >30% | Improve indexing or switch |

## Migration Path

### To Switch Providers

1. **Implement new provider class** extending `SearchProvider`
2. **Update factory** in `src/lib/services/search/index.js`:
   ```javascript
   const provider = 'meilisearch'; // or 'typesense'
   ```
3. **Test thoroughly** - The abstraction should handle the rest
4. **Update documentation** with new provider specifics

### Candidate Alternatives

- **Meilisearch** - Open-source, self-hostable, similar API
- **Typesense** - Fast, open-source, typo-tolerant
- **Elasticsearch** - Enterprise-grade, more complex
- **Custom solution** - Full control, higher maintenance

## Troubleshooting

### Search Not Working

1. Check environment variables are set correctly
2. Verify Algolia app and index exist
3. Check browser console for errors
4. Run `npm run algolia:status` to verify configuration

### Index Out of Date

Run a full reindex:
```bash
npm run algolia:index:apply -- --clear
```

### Poor Search Quality

1. Check zero-result rate
2. Review search queries in Algolia dashboard
3. Adjust `searchableAttributes` ranking
4. Consider adding synonyms or query rules

### High Costs

1. Review search volume in dashboard
2. Check for automated/bot traffic
3. Verify query length requirements are enforced
4. Consider implementing rate limiting

## Best Practices

1. **Never commit** `ALGOLIA_ADMIN_KEY` to version control
2. **Always test** indexing with dry-run first
3. **Monitor costs** regularly in Algolia dashboard
4. **Keep index minimal** - Don't index what you won't search
5. **Use abstractions** - Never import `algoliasearch` directly in components
6. **Document changes** - Update this guide when modifying search

## Security

- Search API key is public and read-only
- Admin key must remain private and server-side only
- API keys should be rotated periodically
- Rate limiting should be configured in Algolia dashboard

## Support

For issues or questions:
1. Check Algolia status page
2. Review application logs
3. Test with `npm run algolia:status`
4. Check Algolia dashboard analytics
