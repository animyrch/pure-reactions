// node:crypto's export cannot be replaced under ESM. This wrapper is the
// compare the stats token check calls, so tests can see that it ran.
import { timingSafeEqual } from 'node:crypto';

export function secretEqual(left, right) {
  return timingSafeEqual(left, right);
}
