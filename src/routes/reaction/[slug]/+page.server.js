import { getReactionBySlug } from '#lib/server/firebaseAdmin.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const slug = params.slug;
  if (!slug) {
    return { reaction: null };
  }

  const reaction = await getReactionBySlug(slug);
  return { reaction: reaction ?? null };
}
