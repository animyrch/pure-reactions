import { describe, expect, it } from 'vitest';
import {
  adHocQueueHasNext,
  nextAdHocQueueIndex,
  readAdHocQueueFromUrl,
} from '../../src/lib/helpers/adHocQueue';

describe('ad hoc reaction queue', () => {
  it('treats index 0 as the first item and still has a next reaction', () => {
    const url = new URL(
      'https://purereactions.com/reaction/a?adHocQueue=%5B%22a%22%2C%22b%22%2C%22c%22%2C%22d%22%5D&adHocQueueIndex=0',
    );

    const parsed = readAdHocQueueFromUrl(url);

    expect(parsed).toEqual({ queue: ['a', 'b', 'c', 'd'], index: 0 });
    expect(adHocQueueHasNext(parsed.queue, parsed.index)).toBe(true);
    expect(nextAdHocQueueIndex(parsed.index)).toBe(1);
  });

  it('has no next reaction on the last item', () => {
    expect(adHocQueueHasNext(['a', 'b'], 1)).toBe(false);
  });
});
