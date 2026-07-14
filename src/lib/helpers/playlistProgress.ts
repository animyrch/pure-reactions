export type PlaylistProgress = {
  v: 1;
  userId: string;
  playlistSlug: string;
  index: number;
  reactionId: string;
  updatedAt: number;
};

const STORAGE_PREFIX = 'pureReactions:playlistProgress:v1';

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export const buildPlaylistProgressKey = (userId: string, playlistSlug: string) => {
  return `${STORAGE_PREFIX}:${userId}:${playlistSlug}`;
};

const safeParse = (value: string | null): any => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const readPlaylistProgress = (userId: string, playlistSlug: string): PlaylistProgress | null => {
  if (!userId || !playlistSlug || !isBrowser()) return null;
  const raw = safeParse(localStorage.getItem(buildPlaylistProgressKey(userId, playlistSlug)));
  if (!raw || raw.v !== 1) return null;
  if (raw.userId !== userId || raw.playlistSlug !== playlistSlug) return null;
  if (typeof raw.reactionId !== 'string' || !raw.reactionId) return null;
  if (typeof raw.index !== 'number' || !Number.isFinite(raw.index)) return null;
  if (typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt)) return null;
  return raw as PlaylistProgress;
};

export const writePlaylistProgress = (
  userId: string,
  playlistSlug: string,
  payload: { reactionId: string; index: number },
) => {
  if (!userId || !playlistSlug || !payload?.reactionId || !isBrowser()) return;

  const next: PlaylistProgress = {
    v: 1,
    userId,
    playlistSlug,
    reactionId: payload.reactionId,
    index: Number(payload.index) || 0,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(buildPlaylistProgressKey(userId, playlistSlug), JSON.stringify(next));
  } catch (error) {
    console.warn('[playlistProgress] failed to persist', error);
  }
};