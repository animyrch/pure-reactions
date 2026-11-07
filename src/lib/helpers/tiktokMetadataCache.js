/**
 * Pure TikTok oEmbed snapshot rules.
 * The server module owns Firestore and the TikTok HTTP call.
 * A successful answer is reused until expiresAt. Failures are not stored.
 */

export const TIKTOK_METADATA_FRESH_MS = 24 * 60 * 60 * 1000;
export const TIKTOK_METADATA_CACHE_LOCK_TTL_MS = 15_000;

export function isFreshTikTokMetadataSnapshot(snapshot, now) {
  if (!snapshot || snapshot.status !== 'ready' || snapshot.outcome !== 'ok') return false;
  if (typeof snapshot.expiresAt !== 'number' || snapshot.expiresAt <= now) return false;
  if (typeof snapshot.videoId !== 'string' || !snapshot.videoId) return false;
  return Boolean(snapshot.meta) && typeof snapshot.meta === 'object';
}

export function buildTikTokMetadataSnapshot({ videoId, canonicalUrl, meta, now }) {
  return {
    status: 'ready',
    outcome: 'ok',
    videoId,
    canonicalUrl: typeof canonicalUrl === 'string' ? canonicalUrl : '',
    meta,
    fetchedAt: now,
    expiresAt: now + TIKTOK_METADATA_FRESH_MS,
    lockedAt: 0,
    lockId: '',
  };
}

async function loadFreshOrFetch({ store, videoId, canonicalUrl, fetchMetadata, now }) {
  const existing = await store.readFresh(videoId, now());
  if (existing) return { cache: 'hit', meta: existing.meta, canonicalUrl: existing.canonicalUrl || canonicalUrl };

  let claim = null;
  try {
    claim = await store.claim(videoId, now());
    if (claim.state === 'ready' && isFreshTikTokMetadataSnapshot(claim.snapshot, now())) {
      return {
        cache: 'hit',
        meta: claim.snapshot.meta,
        canonicalUrl: claim.snapshot.canonicalUrl || canonicalUrl,
      };
    }
    if (claim.state === 'pending') {
      const waited = await store.waitForFresh(videoId);
      if (isFreshTikTokMetadataSnapshot(waited, now())) {
        return { cache: 'hit', meta: waited.meta, canonicalUrl: waited.canonicalUrl || canonicalUrl };
      }
      claim = await store.claim(videoId, now());
      if (claim.state === 'ready' && isFreshTikTokMetadataSnapshot(claim.snapshot, now())) {
        return {
          cache: 'hit',
          meta: claim.snapshot.meta,
          canonicalUrl: claim.snapshot.canonicalUrl || canonicalUrl,
        };
      }
    }
    if (claim.state !== 'claimed' || !claim.lockId) {
      const fetched = await fetchMetadata();
      return { cache: 'miss', meta: fetched.meta, canonicalUrl };
    }

    const fetched = await fetchMetadata();
    const snapshot = buildTikTokMetadataSnapshot({
      videoId,
      canonicalUrl,
      meta: fetched.meta,
      now: now(),
    });
    await store.write(videoId, snapshot, claim.lockId);
    return { cache: 'miss', meta: fetched.meta, canonicalUrl };
  } catch (error) {
    if (claim?.state === 'claimed' && claim.lockId) {
      await store.release(videoId, claim.lockId).catch(() => {});
    }
    throw error;
  }
}

export async function resolveCachedTikTokMetadata({
  videoId,
  canonicalUrl,
  store,
  fetchMetadata,
  inflight,
  now = () => Date.now(),
}) {
  const current = inflight.get(videoId);
  if (current) return current;

  const promise = loadFreshOrFetch({
    store,
    videoId,
    canonicalUrl,
    fetchMetadata,
    now,
  }).finally(() => {
    if (inflight.get(videoId) === promise) inflight.delete(videoId);
  });

  inflight.set(videoId, promise);
  return promise;
}
