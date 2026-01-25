import { error } from '@sveltejs/kit';
import { getReactionsByUserId } from '$lib/helpers/firebase';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const userId = params.id;
  if (!userId) {
    throw error(404, 'Not found');
  }

  const reactions = await getReactionsByUserId(userId);

  return {
    userId,
    reactions
  };
}
