
import { error } from '@sveltejs/kit';
import {
  getMomentByRouteId,
  getPublishedMomentReactionsServer
} from '$lib/server/firebaseAdmin';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const routeId = params.slug;
  console.log('[MOMENT PAGE] Route param (slug):', routeId);
  if (!routeId) {
    console.error('[MOMENT PAGE] No routeId provided');
    throw error(404, 'Moment not found');
  }

  const moment = await getMomentByRouteId(routeId);
  console.log('[MOMENT PAGE] getMomentByRouteId result:', moment);
  if (!moment?.id) {
    console.error('[MOMENT PAGE] No moment found for routeId:', routeId);
    throw error(404, 'Moment not found');
  }

  const reactions = await getPublishedMomentReactionsServer(moment.id);
  console.log('[MOMENT PAGE] getPublishedMomentReactionsServer result:', reactions);
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
