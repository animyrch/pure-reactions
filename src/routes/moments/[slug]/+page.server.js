import { error } from '@sveltejs/kit';
import {
  getMomentByRouteId,
  getPublishedMomentReactionsServer
} from '$lib/server/firebaseAdmin';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const routeId = params.slug;
  if (!routeId) {
    throw error(404, 'Moment not found');
  }

  const moment = await getMomentByRouteId(routeId);
  if (!moment?.id) {
    throw error(404, 'Moment not found');
  }

  const reactions = await getPublishedMomentReactionsServer(moment.id);
  const reactionIds = reactions.map((entry) => entry.id);
  const firstReactionId = reactionIds[0] || null;

  return {
    moment,
    reactions,
    reactionIds,
    firstReactionId,
    slug: routeId
  };
}
