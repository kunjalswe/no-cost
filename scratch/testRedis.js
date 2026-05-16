const redis = require('../src/utils/redisClient');

async function test() {
    console.log('Checking Redis availability...');
    // Wait a bit for the connection event
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Is available:', redis.isAvailable);
    
    if (redis.isAvailable) {
        await redis.set('test_key', { hello: 'world' });
        const val = await redis.get('test_key');
        console.log('Retrieved:', val);
    } else {
        console.log('Redis is NOT available. Please make sure Redis is running on localhost:6379');
    }
    process.exit(0);
}

test();
