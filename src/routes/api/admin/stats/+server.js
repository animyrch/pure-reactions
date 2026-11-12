import { json } from '@sveltejs/kit';
import { parseStatsIdRequest } from '#lib/helpers/adminStats.js';
import { authorizeStatsRequest, loadOutsideStats, presentedStatsBearer } from '#lib/server/adminStats.js';
import { initializeFirebaseAdmin } from '#lib/server/firebaseAdmin.js';
import { RATE_LIMITS, enforceRateLimit } from '#lib/server/rateLimit.js';

const NO_STORE = { 'Cache-Control': 'no-store' };
const API_TOKEN_RATE_ID = 'admin-stats-api-token';

function unauthorized() {
  return new Response(null, { status: 401, headers: NO_STORE });
}

export const GET = async ({ request }) => {
  const presented = presentedStatsBearer(request.headers.get('authorization'));
  if (!presented) return unauthorized();

  const { adminAuth, adminDb } = await initializeFirebaseAdmin();
  const auth = await authorizeStatsRequest({ presented, adminAuth });
  if (!auth.ok) return unauthorized();

  const limited = await enforceRateLimit({
    id: auth.uid || API_TOKEN_RATE_ID,
    ...RATE_LIMITS.adminStats,
  });
  if (limited) return limited;

  if (typeof adminAuth?.listUsers !== 'function' || typeof adminDb?.collection !== 'function') {
    return json({ error: 'Server configuration error' }, { status: 500, headers: NO_STORE });
  }

  try {
    const idLists = parseStatsIdRequest(new URL(request.url).searchParams.getAll('ids'));
    const counts = await loadOutsideStats({
      adminAuth,
      adminDb,
      includePublishedIds: idLists.published,
      includeUnpublishedIds: idLists.unpublished,
    });
    const body = {
      outside_signups: counts.outsideSignups,
      outside_reactions_published: counts.published,
      outside_reactions_unpublished: counts.unpublished,
      generated_at: new Date().toISOString(),
    };
    if (idLists.published) body.outside_reactions_published_ids = counts.publishedIds;
    if (idLists.unpublished) body.outside_reactions_unpublished_ids = counts.unpublishedIds;
    return json(body, { headers: NO_STORE });
  } catch (error) {
    console.error('Admin stats failed:', error);
    return json({ error: 'Could not load stats.' }, { status: 500, headers: NO_STORE });
  }
};
