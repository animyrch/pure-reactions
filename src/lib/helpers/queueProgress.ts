export type QueueProgress = {
  v: 1;
  userId: string;
  queueSlug: string;
  index: number;
  reactionId: string;
  updatedAt: number;
};

const STORAGE_PREFIX = 'pureReactions:queueProgress:v1';

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export const buildQueueProgressKey = (userId: string, queueSlug: string) => {
  return `${STORAGE_PREFIX}:${userId}:${queueSlug}`;
};

const safeParse = (value: string | null): any => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const readQueueProgress = (userId: string, queueSlug: string): QueueProgress | null => {
  if (!userId || !queueSlug || !isBrowser()) return null;
  const raw = safeParse(localStorage.getItem(buildQueueProgressKey(userId, queueSlug)));
  if (!raw || raw.v !== 1) return null;
  if (raw.userId !== userId || raw.queueSlug !== queueSlug) return null;
  if (typeof raw.reactionId !== 'string' || !raw.reactionId) return null;
  if (typeof raw.index !== 'number' || !Number.isFinite(raw.index)) return null;
  if (typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt)) return null;
  return raw as QueueProgress;
};

export const writeQueueProgress = (
  userId: string,
  queueSlug: string,
  payload: { reactionId: string; index: number }
) => {
  if (!userId || !queueSlug || !payload?.reactionId || !isBrowser()) return;

  const next: QueueProgress = {
    v: 1,
    userId,
    queueSlug,
    reactionId: payload.reactionId,
    index: Number(payload.index) || 0,
    updatedAt: Date.now()
  };

  try {
    localStorage.setItem(buildQueueProgressKey(userId, queueSlug), JSON.stringify(next));
  } catch (error) {
    // Ignore quota/security errors
    console.warn('[queueProgress] failed to persist', error);
  }
};
