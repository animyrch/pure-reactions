import { STATS_ADMIN_UIDS, STATS_API_TOKEN, STATS_EXCLUDED_UIDS } from '$app/env/private';
import { FieldPath } from 'firebase-admin/firestore';
import { COLLECTION_REACTION_BINOMES } from '#lib/constants/firebase.js';
import {
  classifyStatsReaction,
  classifyStatsUser,
  parseStatsUidList,
  statsBearerTokensMatch,
} from '#lib/helpers/adminStats.js';

export const STATS_USER_PAGE_SIZE = 1000;
export const STATS_REACTION_PAGE_SIZE = 500;

function readEnv(name) {
  const fromKit =
    name === 'STATS_API_TOKEN'
      ? STATS_API_TOKEN
      : name === 'STATS_ADMIN_UIDS'
        ? STATS_ADMIN_UIDS
        : name === 'STATS_EXCLUDED_UIDS'
          ? STATS_EXCLUDED_UIDS
          : '';
  const trimmed = typeof fromKit === 'string' ? fromKit.trim() : '';
  if (trimmed) return trimmed;
  const fromProcess = process.env[name];
  return typeof fromProcess === 'string' ? fromProcess.trim() : '';
}

export function presentedStatsBearer(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

export async function authorizeStatsRequest({ presented, adminAuth }) {
  if (presented && statsBearerTokensMatch(presented, readEnv('STATS_API_TOKEN'))) {
    return { ok: true, uid: '' };
  }

  const adminUids = new Set(parseStatsUidList(readEnv('STATS_ADMIN_UIDS')));
  if (!presented || adminUids.size === 0 || typeof adminAuth?.verifyIdToken !== 'function') {
    return { ok: false, uid: '' };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(presented);
    const uid = typeof decoded?.uid === 'string' ? decoded.uid : '';
    if (uid && adminUids.has(uid)) return { ok: true, uid };
  } catch {
    return { ok: false, uid: '' };
  }
  return { ok: false, uid: '' };
}

export async function loadOutsideStats({ adminAuth, adminDb }) {
  const excluded = new Set(parseStatsUidList(readEnv('STATS_EXCLUDED_UIDS')));
  let outsideSignups = 0;
  let pageToken = '';
  const seenTokens = new Set();

  for (;;) {
    if (pageToken) {
      if (seenTokens.has(pageToken)) throw new Error('Could not list accounts');
      seenTokens.add(pageToken);
    }
    const page = await adminAuth.listUsers(STATS_USER_PAGE_SIZE, pageToken || undefined);
    if (!Array.isArray(page?.users)) throw new Error('Could not list accounts');
    for (const user of page.users) {
      const verdict = classifyStatsUser(user, excluded);
      if (verdict.excluded) {
        if (verdict.uid) excluded.add(verdict.uid);
        continue;
      }
      outsideSignups += 1;
    }
    const next = typeof page.pageToken === 'string' ? page.pageToken : '';
    if (!next) break;
    pageToken = next;
  }

  let published = 0;
  let unpublished = 0;
  const publishedIds = [];
  let lastDoc = null;
  let lastId = '';
  const collection = adminDb.collection(COLLECTION_REACTION_BINOMES);

  for (;;) {
    let query = collection
      .select('reactorId', 'isPublished')
      .orderBy(FieldPath.documentId())
      .limit(STATS_REACTION_PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    const docs = snapshot?.docs || [];
    if (docs.length === 0) break;
    for (const doc of docs) {
      const bucket = classifyStatsReaction(doc.data(), excluded);
      if (bucket === 'published') {
        published += 1;
        publishedIds.push(doc.id);
      } else if (bucket === 'unpublished') unpublished += 1;
    }
    const nextId = docs[docs.length - 1]?.id || '';
    if (!nextId || nextId === lastId) throw new Error('Could not list reactions');
    lastId = nextId;
    lastDoc = docs[docs.length - 1];
    if (docs.length < STATS_REACTION_PAGE_SIZE) break;
  }

  return { outsideSignups, published, unpublished, publishedIds };
}
