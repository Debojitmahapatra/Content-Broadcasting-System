import Redis from 'ioredis';

let redisClient = null;

if (process.env.ENABLE_CACHE === 'true') {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    // Disable auto-reconnect spam if Redis is not running
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 2 ? null : 200),
    lazyConnect: true,
  });

  try {
    await client.connect();
    console.log('Redis connected.');
    redisClient = client;
  } catch (err) {
    console.warn(`Redis unavailable — caching disabled. (${err.message})`);
    client.disconnect();
    redisClient = null;
  }

  client.on('error', (err) => {
    // Suppress repeated error logs after initial failure
    if (process.env.NODE_ENV === 'development') {
      console.warn('Redis error:', err.message);
    }
  });
} else {
  console.log('Caching disabled (ENABLE_CACHE != true).');
}

export default redisClient;
