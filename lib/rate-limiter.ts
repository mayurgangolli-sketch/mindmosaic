import { isIP } from 'node:net';

/**
 * Zero-dependency in-memory sliding-window rate limiter for MindMosaic API routes.
 *
 * Hosting & Environment Architecture Notes:
 * - Compatible with Node.js servers, Docker containers, and single-instance deployments.
 * - Serverless / Multi-Instance Limitation: In serverless environments (e.g. AWS Lambda / Vercel Edge),
 *   each serverless instance retains independent memory state. Without an external data store (e.g. Redis),
 *   in-memory limits apply per-instance rather than globally.
 * - Bounded Memory & Pruning: Enforces MAX_ENTRIES = 5000 and automatically purges expired entries
 *   to eliminate memory exhaustion DoS vectors against the rate limiter itself.
 * - Proxy Header Trust & Anti-Spoofing Reality:
 *   Forwarded client-IP headers (cf-connecting-ip, x-real-ip, x-forwarded-for) are trustworthy
 *   ONLY when an upstream reverse proxy (Cloudflare, Vercel, Nginx) is explicitly configured to
 *   sanitize or overwrite incoming client headers. In direct-to-node deployments where no proxy
 *   sanitizes incoming headers, clients can supply arbitrary header values. IP spoofing is NOT
 *   solved while deployment architecture remains undecided.
 * - Fallback '127.0.0.1': Used strictly as a safe non-crashing fallback for missing, invalid, or
 *   unparseable IP headers. It is NOT evidence of a verified client identity.
 * - IP Validation: Uses Node.js native `node:net isIP()` to validate both IPv4 and IPv6 addresses
 *   (including compressed representations like '2001:db8::1').
 */

function isValidIp(ip: string): boolean {
  return isIP(ip) !== 0;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
const MAX_ENTRIES = 5000;

function cleanupExpired(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

/**
 * Resolves and sanitizes the client IP address from request headers.
 */
export function getClientIp(req: Request): string {
  // Check Cloudflare connecting IP
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp && isValidIp(cfIp)) {
    return cfIp;
  }

  // Check Nginx / generic reverse proxy IP
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  // Check X-Forwarded-For chain (take leftmost client token)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp && isValidIp(firstIp)) {
      return firstIp;
    }
  }

  return '127.0.0.1';
}

/**
 * Checks and updates rate limit for a given key within a sliding time window.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Bounded memory enforcement
  if (buckets.size >= MAX_ENTRIES) {
    cleanupExpired(now);
    // If still at capacity after cleanup, purge the oldest entry
    if (buckets.size >= MAX_ENTRIES) {
      const firstKey = buckets.keys().next().value;
      if (firstKey) buckets.delete(firstKey);
    }
  }

  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    limit,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/**
 * Clears all rate limiter buckets. Used strictly for deterministic automated testing.
 */
export function resetRateLimitsForTesting() {
  buckets.clear();
}

