const BOT_ID = process.env.CLIENT_ID;
const TOPGG_TOKEN = process.env.TOPGG_TOKEN;

const POST_COOLDOWN_MS = 60_000;
const STATS_CACHE_MS = 60_000;

let lastPostAt = 0;
let cachedStats = null;
let cachedStatsAt = 0;

function isConfigured() {
    return Boolean(TOPGG_TOKEN && BOT_ID);
}

async function postStats(serverCount, { force = false } = {}) {
    if (!isConfigured()) return false;

    const now = Date.now();
    if (!force && now - lastPostAt < POST_COOLDOWN_MS) return false;

    try {
        const response = await fetch('https://top.gg/api/bots/stats', {
            method: 'POST',
            headers: {
                Authorization: TOPGG_TOKEN,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ server_count: serverCount }),
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(`[Top.gg] Failed to post stats (${response.status}):`, body);
            return false;
        }

        lastPostAt = now;
        cachedStats = { server_count: serverCount };
        cachedStatsAt = now;
        return true;
    } catch (error) {
        console.error('[Top.gg] Error posting stats:', error);
        return false;
    }
}

async function getStats() {
    if (!isConfigured()) return null;

    const now = Date.now();
    if (cachedStats && now - cachedStatsAt < STATS_CACHE_MS) {
        return cachedStats;
    }

    try {
        const response = await fetch(`https://top.gg/api/bots/${BOT_ID}/stats`, {
            headers: { Authorization: TOPGG_TOKEN },
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(`[Top.gg] Failed to fetch stats (${response.status}):`, body);
            return null;
        }

        const data = await response.json();
        cachedStats = data;
        cachedStatsAt = now;
        return data;
    } catch (error) {
        console.error('[Top.gg] Error fetching stats:', error);
        return null;
    }
}

module.exports = { isConfigured, postStats, getStats };
