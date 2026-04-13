import { getPlaylistBySlug } from '$lib/server/firebaseAdmin';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const slug = params.slug;
  if (!slug) {
    return { playlist: null };
  }

  const playlist = await getPlaylistBySlug(slug);
  return { playlist: playlist ?? null };
}
