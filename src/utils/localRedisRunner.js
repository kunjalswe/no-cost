const { RedisMemoryServer } = require('redis-memory-server');
const fs = require('fs');
const path = require('path');

async function startLocalRedis() {
    const redisServer = new RedisMemoryServer();

    try {
        const host = await redisServer.getHost();
        const port = await redisServer.getPort();
        const redisUrl = `redis://${host}:${port}`;

        console.log(`[LocalRedis] Started in-memory Redis at ${redisUrl}`);
        
        // We set it in process.env so the redisClient can pick it up
        process.env.REDIS_URL = redisUrl;
        
        return redisServer;
    } catch (error) {
        console.error('[LocalRedis] Failed to start in-memory Redis:', error);
        return null;
    }
}

module.exports = { startLocalRedis };
