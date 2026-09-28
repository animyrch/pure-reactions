export const slugifyMomentTitle = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const trimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * A moment is public once it has an original video URL, a title, and a time
 * in that video. Reaction count may be zero.
 */
export const assertMomentReady = ({ title, originalVideoUrl, momentTimeSeconds } = {}) => {
  const trimmedTitle = trimmedString(title);
  const trimmedUrl = trimmedString(originalVideoUrl);
  const anchor = Number(momentTimeSeconds);

  if (!trimmedUrl) {
    return { ok: false, error: 'Add the original video URL.' };
  }
  if (!trimmedTitle) {
    return { ok: false, error: 'Give this moment a short, memorable title.' };
  }
  if (!Number.isFinite(anchor) || anchor < 0) {
    return { ok: false, error: 'Enter the moment timing in seconds (0 or greater).' };
  }

  return {
    ok: true,
    value: {
      title: trimmedTitle,
      originalVideoUrl: trimmedUrl,
      momentTimeSeconds: anchor,
      reactionCount: 0
    }
  };
};

export const momentMatchesQuery = (moment, query) => {
  const needle = trimmedString(query).toLowerCase();
  if (!needle) return true;
  const haystack = [
    moment?.title,
    moment?.originalVideoTitle,
    moment?.originalVideoAuthor,
    moment?.originalVideoUrl,
    ...(Array.isArray(moment?.tags) ? moment.tags : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
};

/**
 * The moments catalogue reads Firestore so a moment shows up as soon as it is
 * saved. Algolia is only a text-search index and lags behind that write.
 */
export const shouldListMomentsFromFirestore = ({ query = '', tag = '', hasAlgolia = false } = {}) => {
  if (!hasAlgolia) return true;
  return trimmedString(query).length === 0 && trimmedString(tag).length === 0;
};

const momentHitId = (moment) => moment?.objectID || moment?.id || '';

export const mergeUnindexedMomentHits = (freshMatches = [], indexedHits = []) => {
  const indexedIds = new Set(indexedHits.map(momentHitId).filter(Boolean));
  const extras = freshMatches.filter((moment) => {
    const id = momentHitId(moment);
    return id && !indexedIds.has(id);
  });
  return [...extras, ...indexedHits];
};
