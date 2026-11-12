/**
 * Outside-stats rules. Firebase reads and HTTP live in the server module.
 * An account is outside when its UID is not listed, none of its emails match
 * the private or test patterns, and none of its names are an owner channel.
 * A reaction follows its creator UID, and also the name stored on the reaction.
 */

import { createHash } from 'node:crypto';
import * as secrets from '#lib/helpers/secretEqual.js';

export const STATS_EXCLUDED_EMAIL_PREFIXES = ['emirgokhanozcelik@', 'emirgokhanozcelik+'];
export const STATS_EXCLUDED_EMAIL_SUFFIX = '@test.com';
export const STATS_EXCLUDED_DISPLAY_NAME_PREFIX = 'animy';
export const STATS_EXCLUDED_DISPLAY_NAMES = ['demo by admin'];
export const MIN_STATS_API_TOKEN_BYTES = 32;

const UNCONFIGURED_TOKEN = '0'.repeat(MIN_STATS_API_TOKEN_BYTES);

export function parseStatsIdRequest(raw) {
  const tokens = new Set();
  const values = Array.isArray(raw) ? raw : [raw];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const part of value.split(',')) {
      const token = part.trim().toLowerCase();
      if (token === 'published' || token === 'unpublished') tokens.add(token);
    }
  }
  return {
    published: tokens.has('published'),
    unpublished: tokens.has('unpublished'),
  };
}

export function parseStatsUidList(raw) {
  if (typeof raw !== 'string') return [];
  const uids = [];
  const seen = new Set();
  for (const part of raw.split(',')) {
    const uid = part.trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    uids.push(uid);
  }
  return uids;
}

export function statsTokenIsConfigured(token) {
  return typeof token === 'string' && Buffer.byteLength(token, 'utf8') >= MIN_STATS_API_TOKEN_BYTES;
}

/**
 * Hash both sides so timingSafeEqual always compares equal-length digests.
 * A missing or short server token is compared against a stand-in and rejected.
 */
export function statsBearerTokensMatch(provided, expected) {
  const configured = statsTokenIsConfigured(expected);
  const candidate = configured ? expected : UNCONFIGURED_TOKEN;
  const presented = typeof provided === 'string' ? provided : '';
  const providedDigest = createHash('sha256').update(presented, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(candidate, 'utf8').digest();
  const equal = secrets.secretEqual(providedDigest, expectedDigest);
  return configured && equal;
}

export function isExcludedStatsEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return (
    STATS_EXCLUDED_EMAIL_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    normalized.endsWith(STATS_EXCLUDED_EMAIL_SUFFIX)
  );
}

export function isExcludedStatsDisplayName(name) {
  if (typeof name !== 'string') return false;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith(STATS_EXCLUDED_DISPLAY_NAME_PREFIX) ||
    STATS_EXCLUDED_DISPLAY_NAMES.includes(normalized)
  );
}

function accountEmails(user) {
  const emails = [];
  if (typeof user?.email === 'string') emails.push(user.email);
  if (Array.isArray(user?.providerData)) {
    for (const provider of user.providerData) {
      if (typeof provider?.email === 'string') emails.push(provider.email);
    }
  }
  return emails;
}

function accountDisplayNames(user) {
  const names = [];
  if (typeof user?.displayName === 'string') names.push(user.displayName);
  if (Array.isArray(user?.providerData)) {
    for (const provider of user.providerData) {
      if (typeof provider?.displayName === 'string') names.push(provider.displayName);
    }
  }
  return names;
}

export function classifyStatsUser(user, excludedUids) {
  const uid = typeof user?.uid === 'string' ? user.uid : '';
  const excluded =
    (uid !== '' && excludedUids.has(uid)) ||
    accountEmails(user).some((email) => isExcludedStatsEmail(email)) ||
    accountDisplayNames(user).some((name) => isExcludedStatsDisplayName(name));
  return { uid, excluded };
}

/**
 * `published` and `unpublished` together are every reaction whose creator
 * UID is still outside. Only a boolean true is published.
 */
export function classifyStatsReaction(data, excludedUids) {
  const creatorUid = typeof data?.reactorId === 'string' ? data.reactorId : '';
  if (creatorUid !== '' && excludedUids.has(creatorUid)) return 'excluded';
  if (isExcludedStatsDisplayName(data?.reactorDisplayName)) return 'excluded';
  return data?.isPublished === true ? 'published' : 'unpublished';
}
