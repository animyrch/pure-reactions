import { getReactionsByReactorServer } from '$lib/server/firebaseAdmin';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const slug = params.slug;
  if (!slug) {
    return { reactorPureReactions: [] };
  }

  const reactorPureReactions = await getReactionsByReactorServer(slug);
  return { reactorPureReactions };
}
