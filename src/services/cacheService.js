import redisClient from '../config/redis.js';

/**
 * Store a value in Redis with an optional TTL.
 * Silently no-ops if Redis is unavailable.
 *
 * @param {string} key
 * @param {*}      value       - Will be JSON-serialised
 * @param {number} [ttlSeconds=60]
 */
export async function set(key, value, ttlSeconds = 60) {
  if (!redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn(`[cache] set failed for key "${key}":`, err.message);
  }
}

/**
 * Retrieve a cached value. Returns null on miss or Redis unavailability.
 *
 * @param {string} key
 * @returns {Promise<*|null>}
 */
export async function get(key) {
  if (!redisClient) return null;
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`[cache] get failed for key "${key}":`, err.message);
    return null;
  }
}

/**
 * Delete one or more keys matching a pattern.
 * Uses SCAN + DEL to avoid blocking Redis with KEYS on large datasets.
 *
 * @param {string} pattern - e.g. "broadcast:teacher:1:*"
 */
export async function del(pattern) {
  if (!redisClient) return;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.warn(`[cache] del failed for pattern "${pattern}":`, err.message);
  }
}

/**
 * Generates a consistent cache key for broadcast responses.
 *
 * @param {number|string} teacherId
 * @param {string|null}   subject   - null means "all subjects"
 * @returns {string}
 */
export function generateBroadcastCacheKey(teacherId, subject) {
  return `broadcast:teacher:${teacherId}:subject:${subject ?? 'all'}`;
}
