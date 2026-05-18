const DEFAULT_DELAY_MS = 1200;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class ThrottledQueue {
    constructor(minIntervalMs = DEFAULT_DELAY_MS) {
        this.minIntervalMs = minIntervalMs;
        this.chain = Promise.resolve();
        this.lastRunAt = 0;
    }

    enqueue(task) {
        const run = this.chain.then(async () => {
            const wait = Math.max(0, this.lastRunAt + this.minIntervalMs - Date.now());
            if (wait > 0) {
                await sleep(wait);
            }

            try {
                return await task();
            } finally {
                this.lastRunAt = Date.now();
            }
        });

        this.chain = run.catch(() => {});
        return run;
    }
}

const messageQueue = new ThrottledQueue(
    Number(process.env.MESSAGE_SEND_DELAY_MS) || DEFAULT_DELAY_MS,
);

async function sendWithRetry(sendFn, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await sendFn();
        } catch (error) {
            lastError = error;
            const isRateLimit = error?.status === 429 || error?.code === 429;
            if (!isRateLimit || attempt === maxRetries - 1) {
                throw error;
            }

            const retryMs = (error.retryAfter ?? 5) * 1000 + 250;
            console.warn(`[RateLimit] Hit 429, waiting ${retryMs}ms before retry (${attempt + 1}/${maxRetries})`);
            await sleep(retryMs);
        }
    }

    throw lastError;
}

/**
 * Queue channel.send() calls globally to avoid Discord 429s during bulk posts.
 */
function sendChannelMessage(channel, options) {
    return messageQueue.enqueue(() =>
        sendWithRetry(() => channel.send(options)),
    );
}

module.exports = { sendChannelMessage, ThrottledQueue, sleep };
