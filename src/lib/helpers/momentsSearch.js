import { env } from '$env/dynamic/public';
import { getSearchProvider, normalizeQuery } from '$lib/services/search';
import { ALGOLIA_MOMENTS_INDEX } from '$lib/constants/algolia';
import { getMomentsByPage } from '$lib/helpers/momentsFirestore';
import { MOMENT_SORT_OPTIONS } from '$lib/constants/moments';
import {
  mergeUnindexedMomentHits,
  momentMatchesQuery,
  shouldListMomentsFromFirestore
} from '$lib/helpers/moments';

export const hasMomentsAlgoliaIndex = () =>
  Boolean(
    env.PUBLIC_ALGOLIA_APP_ID &&
      env.PUBLIC_ALGOLIA_SEARCH_API_KEY &&
      ALGOLIA_MOMENTS_INDEX
  );

/**
 * @param {Object} params
 * @param {string} params.query
 * @param {number} params.page
 * @param {number} params.hitsPerPage
 * @param {string} params.sortBy
 * @param {string} params.tag
 * @param {import('firebase/firestore').DocumentSnapshot | null} params.lastFirestoreDoc
 */
async function listMomentsFromFirestore({
  normalizedQuery,
  page,
  hitsPerPage,
  sortBy,
  tag,
  lastFirestoreDoc
}) {
  const { moments, lastVisible } = await getMomentsByPage({
    lastDoc: lastFirestoreDoc,
    limitBy: hitsPerPage,
    sortBy,
    tag
  });

  const filtered = normalizedQuery
    ? moments.filter((moment) => momentMatchesQuery(moment, normalizedQuery))
    : moments;

  return {
    hits: filtered,
    nbHits: filtered.length,
    page,
    nbPages: filtered.length < hitsPerPage ? page + 1 : page + 2,
    lastFirestoreDoc: lastVisible
  };
}

export async function searchMoments({
  query = '',
  page = 0,
  hitsPerPage = 12,
  sortBy = MOMENT_SORT_OPTIONS.NEWEST,
  tag = '',
  lastFirestoreDoc = null
}) {
  const normalizedQuery = normalizeQuery(query);
  const hasAlgolia = hasMomentsAlgoliaIndex();

  if (shouldListMomentsFromFirestore({ query: normalizedQuery, tag, hasAlgolia })) {
    return listMomentsFromFirestore({
      normalizedQuery,
      page,
      hitsPerPage,
      sortBy,
      tag,
      lastFirestoreDoc: page === 0 ? null : lastFirestoreDoc
    });
  }

  const provider = getSearchProvider();
  if (!provider?.isReady?.()) {
    return listMomentsFromFirestore({
      normalizedQuery,
      page,
      hitsPerPage,
      sortBy,
      tag,
      lastFirestoreDoc: page === 0 ? null : lastFirestoreDoc
    });
  }

  const result = await provider.search(normalizedQuery, {
    index: ALGOLIA_MOMENTS_INDEX,
    hitsPerPage,
    page,
    ...(tag ? { filters: `tags:"${tag.replace(/"/g, '')}"` } : {})
  });

  let hits = result.hits || [];
  let extraCount = 0;
  if (page === 0) {
    const { moments } = await getMomentsByPage({
      limitBy: hitsPerPage,
      sortBy: MOMENT_SORT_OPTIONS.NEWEST
    });
    const normalizedTag = tag.trim();
    const freshMatches = moments.filter((moment) => {
      if (normalizedTag && !(Array.isArray(moment.tags) && moment.tags.includes(normalizedTag))) {
        return false;
      }
      return momentMatchesQuery(moment, normalizedQuery);
    });
    const merged = mergeUnindexedMomentHits(freshMatches, hits);
    extraCount = merged.length - hits.length;
    hits = merged;
  }

  return {
    hits,
    nbHits: (result.nbHits || 0) + extraCount,
    page: result.page || 0,
    nbPages: Math.max(result.nbPages || 0, hits.length ? 1 : 0),
    lastFirestoreDoc: null
  };
}
