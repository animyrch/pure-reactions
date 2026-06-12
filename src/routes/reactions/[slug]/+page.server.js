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

  // Ensure the returned payload always contains a `reactions` array and
  // well-formed `originalVideo` structure so older/compiled bundles that
  // access `reactions.length` won't throw.
  return {
    ...data,
    reactions: Array.isArray(data.reactions) ? data.reactions : [],
    originalVideo: data.originalVideo ?? null,
    slug,
  };
}
