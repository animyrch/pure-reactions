import { error } from '@sveltejs/kit';
import { getReactionsByOriginalSlug } from '$lib/server/firebaseAdmin';

export async function load({ params }) {
  const { slug } = params;

  if (!slug) {
    throw error(400, 'Invalid reaction hub slug');
  }

  const data = await getReactionsByOriginalSlug(slug);

  if (!data) {
    throw error(404, 'Reaction hub not found');
  }

  return data;
}
