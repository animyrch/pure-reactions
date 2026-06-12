import { error } from '@sveltejs/kit';
import { getReactionsByOriginalSlug } from '$lib/server/firebaseAdmin';

export async function load({ params }) {
  const { slug } = params;

  if (!slug) {
    throw error(400, 'Invalid reaction hub slug');
  }

  // Diagnostic log to help verify which build is running on Netlify and
  // what `load()` received — this will appear in Netlify function logs.
  try {
    console.log('reactions-load: start', { slug });
  } catch (e) {}

  const data = await getReactionsByOriginalSlug(slug);

  try {
    console.log('reactions-load: fetched', { slug, hasData: !!data, reactionsIsArray: Array.isArray(data?.reactions) });
  } catch (e) {}

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
