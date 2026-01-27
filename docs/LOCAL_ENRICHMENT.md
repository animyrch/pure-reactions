# Local YouTube Enrichment (No Billing)

Use this when you want to populate `youtube.meta` **locally** without Firebase Functions or billing.  
It reads Firestore via service account and updates missing metadata only.

## Requirements

- `FIREBASE_SERVICE_ACCOUNT` (JSON string or path)
- `YOUTUBE_API_KEY` (YouTube Data API v3)

## Run

```bash
export FIREBASE_SERVICE_ACCOUNT="./path/to/serviceAccount.json"
export YOUTUBE_API_KEY="YOUR_YOUTUBE_API_KEY"
npm run enrich-youtube
```

## Defaults

- Collection: `reactions-prod` (override with `PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES`)
- Limit per run: `1000` (override with `ENRICHMENT_LIMIT`)
- Only published docs (`isPublished == true`, fallback `published == true`)
- Only missing/incomplete metadata (no stale refreshes)

## What gets written

```
youtube.meta: {
  videoId,
  title,
  description,
  thumbnail,
  publishedAt,
  durationSeconds
}
lastEnrichedAt
```

## Notes

- This does **not** schedule itself. Run manually as needed.
- When you’re ready to automate, switch to the Firebase Function
