import { getReactionsByCreatorServer } from '#lib/server/firebaseAdmin.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const slug = params.slug;
  if (!slug) {
    return { creatorPureReactions: [] };
  }

  const creatorPureReactions = await getReactionsByCreatorServer(slug);
  return { creatorPureReactions };
}
