const parseQueue = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every((id) => typeof id === 'string' && id.trim())) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const parseAdHocQueueIndex = (raw) => {
  if (raw == null || raw === '') return 0;
  const index = Number(raw);
  return Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
};

export const readAdHocQueueFromUrl = (url) => {
  const queue = parseQueue(url?.searchParams?.get?.('adHocQueue'));
  if (!queue) return { queue: null, index: 0 };
  return {
    queue,
    index: parseAdHocQueueIndex(url.searchParams.get('adHocQueueIndex')),
  };
};

export const adHocQueueHasNext = (queue, index) =>
  Array.isArray(queue) && parseAdHocQueueIndex(index) + 1 < queue.length;

export const nextAdHocQueueIndex = (index) => parseAdHocQueueIndex(index) + 1;
