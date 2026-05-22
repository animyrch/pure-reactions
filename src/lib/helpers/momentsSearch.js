import { env } from '$env/dynamic/public';
import { getSearchProvider, normalizeQuery } from '$lib/services/search';
import { ALGOLIA_MOMENTS_INDEX } from '$lib/constants/algolia';
import { getMomentsByPage } from '$lib/helpers/momentsFirestore';
import { MOMENT_SORT_OPTIONS } from '$lib/constants/moments';

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
export async function searchMoments({
  query = '',
  page = 0,
  hitsPerPage = 12,
  sortBy = MOMENT_SORT_OPTIONS.NEWEST,
  tag = '',
  lastFirestoreDoc = null
}) {
  const normalizedQuery = normalizeQuery(query);

  if (hasMomentsAlgoliaIndex()) {
    const provider = getSearchProvider();
    if (!provider?.isReady?.()) {
      return { hits: [], nbHits: 0, page: 0, nbPages: 0, lastFirestoreDoc: null };
    }

    const result = await provider.search(normalizedQuery, {
      index: ALGOLIA_MOMENTS_INDEX,
      hitsPerPage,
      page,
      ...(tag ? { filters: `tags:"${tag.replace(/"/g, '')}"` } : {})
    });

    return {
      hits: result.hits || [],
      nbHits: result.nbHits || 0,
      page: result.page || 0,
      nbPages: result.nbPages || 0,
      lastFirestoreDoc: null
    };
  }

  const { moments, lastVisible } = await getMomentsByPage({
    lastDoc: lastFirestoreDoc,
    limitBy: hitsPerPage,
    sortBy,
    tag
  });

  let filtered = moments;
  if (normalizedQuery) {
    const needle = normalizedQuery.toLowerCase();
    filtered = moments.filter((moment) => {
      const haystack = [
        moment.title,
        moment.originalVideoTitle,
        moment.originalVideoAuthor,
        ...(Array.isArray(moment.tags) ? moment.tags : [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  return {
    hits: filtered,
    nbHits: filtered.length,
    page: 0,
    nbPages: filtered.length < hitsPerPage ? 1 : page + 2,
    lastFirestoreDoc: lastVisible
  };
}
