/**
 * Pure rate-limit rules. Firestore and HTTP responses live in the server module.
 * A fixed window starts on a round boundary. A saved upstream answer never
 * reaches this helper, because routes count only the call that leaves the app.
 */

// Published Cloudflare ranges as of November 2026.
// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
const CLOUDFLARE_IPV4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

const CLOUDFLARE_IPV6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

export const TEN_MINUTES_MS = 10 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

function ipv4InCidr(ip, cidr) {
  const [base, bitsText] = cidr.split('/');
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const bits = Number(bitsText);
  if (ipInt == null || baseInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function expandIpv6(ip) {
  if (typeof ip !== 'string' || ip.includes('.')) return null;
  const address = ip.split('%')[0];
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  const groups = [...head, ...Array(missing).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const numbers = [];
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    numbers.push(Number.parseInt(group, 16));
  }
  return numbers;
}

function ipv6InCidr(ip, cidr) {
  const [base, bitsText] = cidr.split('/');
  const ipGroups = expandIpv6(ip);
  const baseGroups = expandIpv6(base);
  const bits = Number(bitsText);
  if (!ipGroups || !baseGroups || !Number.isInteger(bits) || bits < 0 || bits > 128) return false;
  let remaining = bits;
  for (let index = 0; index < 8; index += 1) {
    const take = Math.min(16, remaining);
    const mask = take === 0 ? 0 : (0xffff << (16 - take)) & 0xffff;
    if ((ipGroups[index] & mask) !== (baseGroups[index] & mask)) return false;
    remaining -= take;
  }
  return true;
}

export function normalizeIp(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || /[\s/]/.test(trimmed)) return '';
  if (ipv4ToInt(trimmed) != null) return trimmed;
  return expandIpv6(trimmed) ? trimmed.toLowerCase() : '';
}

export function isCloudflareAddress(value) {
  const ip = normalizeIp(value);
  if (!ip) return false;
  if (ip.includes(':')) return CLOUDFLARE_IPV6.some((cidr) => ipv6InCidr(ip, cidr));
  return CLOUDFLARE_IPV4.some((cidr) => ipv4InCidr(ip, cidr));
}

function headerValue(headers, name) {
  if (!headers) return '';
  const value = typeof headers.get === 'function' ? headers.get(name) : headers[name];
  return typeof value === 'string' ? value : '';
}

/**
 * Visitor identity for a public route.
 * A request that arrived from Cloudflare uses CF-Connecting-IP.
 * A direct Netlify request ignores that header, because the caller can set it.
 * An empty string means the check should fail open.
 */
export function visitorKey(headers) {
  const peer = normalizeIp(headerValue(headers, 'x-nf-client-connection-ip'));
  const claimed = normalizeIp(headerValue(headers, 'cf-connecting-ip'));
  if (peer && isCloudflareAddress(peer)) return claimed;
  return peer;
}

export function rateLimitDecision({ snapshot, now, limit, windowMs }) {
  const windowStart = now - (now % windowMs);
  const count =
    snapshot && snapshot.windowStart === windowStart && Number.isFinite(Number(snapshot.count))
      ? Number(snapshot.count)
      : 0;
  if (count >= limit) {
    return {
      allowed: false,
      windowStart,
      count,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    };
  }
  return {
    allowed: true,
    windowStart,
    count: count + 1,
    retryAfterSeconds: 0,
  };
}
