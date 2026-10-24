import { DEFAULT_MOMENT_SORT, MOMENT_SORT_OPTIONS } from '$lib/constants/moments';

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

/**
 * Unknown values, including the removed "trending" option, use the default sort.
 * Trending has no ranking signal in the product.
 */
export const normalizeMomentSort = (sortBy) =>
  sortBy === MOMENT_SORT_OPTIONS.MOST_REACTIONS
    ? MOMENT_SORT_OPTIONS.MOST_REACTIONS
    : DEFAULT_MOMENT_SORT;

export const momentReactionCount = (moment) => {
  const count = Number(moment?.reactionCount);
  return Number.isFinite(count) ? count : 0;
};

export const momentCreatedAtMillis = (moment) => {
  const value = moment?.createdAt;
  if (value == null || value === '') return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const momentIdentity = (moment) => String(moment?.objectID || moment?.id || '');

/**
 * Most reactions ranks by published reaction count, then by newest.
 * A missing count sorts as zero. Equal counts stay in newest-first order.
 */
export const compareMoments = (left, right, sortBy = DEFAULT_MOMENT_SORT) => {
  if (normalizeMomentSort(sortBy) === MOMENT_SORT_OPTIONS.MOST_REACTIONS) {
    const countDelta = momentReactionCount(right) - momentReactionCount(left);
    if (countDelta !== 0) return countDelta;
  }

  const timeDelta = momentCreatedAtMillis(right) - momentCreatedAtMillis(left);
  if (timeDelta !== 0) return timeDelta;

  return momentIdentity(right).localeCompare(momentIdentity(left));
};

export const rankMoments = (moments = [], sortBy = DEFAULT_MOMENT_SORT) =>
  [...moments].sort((left, right) => compareMoments(left, right, sortBy));

/**
 * Page through an already ranked list. An unknown cursor ends the list
 * instead of repeating the first page.
 */
export const pageRankedMoments = (ranked = [], cursorId = '', limitBy = 12) => {
  const pageSize = Number.isFinite(limitBy) && limitBy > 0 ? limitBy : ranked.length;
  let startIndex = 0;
  if (cursorId) {
    const cursorIndex = ranked.findIndex((moment) => momentIdentity(moment) === cursorId);
    startIndex = cursorIndex === -1 ? ranked.length : cursorIndex + 1;
  }
  return ranked.slice(startIndex, startIndex + pageSize);
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
