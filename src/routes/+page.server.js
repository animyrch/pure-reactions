import { getReactionsByPageServer } from '$lib/server/firebaseAdmin';
import { SORTINGS } from '$lib/constants/sortings';

const PAGE_SIZE = 15;

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
  const sortBy = url.searchParams.get('sortBy') || SORTINGS.NEW;

  // Server-side fetch is only available for the default 'new' sort.
  // FOLLOWING sort requires the user's follow list which is not available during SSR.
  if (sortBy !== SORTINGS.NEW) {
    return { reactions: [], lastCursorMs: null };
  }

  const { reactions, lastCursorMs } = await getReactionsByPageServer(null, PAGE_SIZE, sortBy);
  return { reactions, lastCursorMs };
}
