const Redis = require('ioredis');
require('dotenv').config();

class RedisClient {
    constructor() {
        this.client = null;
        this.isAvailable = false;
        this.hasLoggedRefused = false;
        this.reconnectTimeout = 5000; // 5 seconds
        this.init();
    }

    init() {
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        if (!process.env.REDIS_URL) {
            console.warn('[Redis] REDIS_URL not found in environment variables. Caching disabled.');
            return;
        }

        try {
            this.client = new Redis(process.env.REDIS_URL, {
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3
            });

            this.client.on('error', (err) => {
                if (err.code === 'ECONNREFUSED') {
                    if (this.isAvailable || !this.hasLoggedRefused) {
                        console.error('[Redis] Connection refused. Is Redis running on localhost:6379?');
                        this.hasLoggedRefused = true;
                    }
                } else {
                    console.error('[Redis] Connection error:', err.message || err);
                }
                this.isAvailable = false;
            });

            this.client.on('connect', () => {
                console.log('[Redis] Connected to Redis.');
                this.isAvailable = true;
                this.hasLoggedRefused = false;
            });

            this.client.on('close', () => {
                console.warn('[Redis] Connection closed.');
                this.isAvailable = false;
            });
        } catch (error) {
            console.error('[Redis] Failed to initialize Redis client:', error);
            this.isAvailable = false;
        }
    }

    async get(key) {
        if (!this.isAvailable) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`[Redis] Get error for key ${key}:`, error.message);
            return null;
        }
    }

    async set(key, value, ttlSeconds = 3600) {
        if (!this.isAvailable) return false;
        try {
            const stringValue = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.set(key, stringValue, 'EX', ttlSeconds);
            } else {
                await this.client.set(key, stringValue);
            }
            return true;
        } catch (error) {
            console.error(`[Redis] Set error for key ${key}:`, error.message);
            return false;
        }
    }

    async del(key) {
        if (!this.isAvailable) return false;
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error(`[Redis] Del error for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Helper to wrap a function with caching
     * @param {string} key Cache key
     * @param {Function} fetchFn Function to call on cache miss
     * @param {number} ttlSeconds TTL in seconds
     */
    async wrap(key, fetchFn, ttlSeconds = 3600) {
        const cached = await this.get(key);
        if (cached !== null) return cached;

        const result = await fetchFn();
        if (result !== null && result !== undefined) {
            await this.set(key, result, ttlSeconds);
        }
        return result;
    }
}

module.exports = new RedisClient();
