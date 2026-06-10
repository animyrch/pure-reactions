import { error } from '@sveltejs/kit';
import { getReactionsByOriginalSlug } from '$lib/server/firebaseAdmin';

export async function load({ params }) {
  const { slug } = params;
  const reactionHub = await getReactionsByOriginalSlug(slug);

  if (!reactionHub) {
    throw error(404, 'Reaction hub not found');
  }

  return {
    ...reactionHub,
    slug,
  };
}
