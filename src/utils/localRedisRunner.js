async function startLocalRedis() {
    try {
        // We only require this here to avoid errors if the module isn't installed (like on a VPS)
        const { RedisMemoryServer } = require('redis-memory-server');
        const redisServer = new RedisMemoryServer();

        const host = await redisServer.getHost();
        const port = await redisServer.getPort();
        const redisUrl = `redis://${host}:${port}`;

        console.log(`[LocalRedis] Started in-memory Redis at ${redisUrl}`);
        
        // Update process.env so redisClient can pick it up
        process.env.REDIS_URL = redisUrl;
        
        return redisServer;
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.warn('[LocalRedis] redis-memory-server not installed. Skipping internal Redis.');
        } else {
            console.error('[LocalRedis] Failed to start in-memory Redis:', error.message);
        }
        return null;
    }
}

module.exports = { startLocalRedis };
