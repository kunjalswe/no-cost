const os = require('os');
const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js');
const { getDB } = require('../database');
const topgg = require('../utils/topgg');
const broadcastService = require('../utils/broadcastService');
const redis = require('../utils/redisClient');

function formatBytes(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor(seconds / 60) % 60;
    const secs = Math.floor(seconds) % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (secs || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
}

function formatCpuUsage(cpu) {
    const userMs = Math.round(cpu.user / 1000);
    const systemMs = Math.round(cpu.system / 1000);
    return `User ${userMs}ms · System ${systemMs}ms`;
}

function truncate(text, max = 256) {
    if (!text || text.length <= max) return text ?? 'None';
    return `${text.slice(0, max - 3)}...`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Advanced bot diagnostics — uptime, memory, process, and service health.'),

    async execute(interaction) {
        const started = Date.now();
        await interaction.deferReply();

        const client = interaction.client;
        const db = getDB();
        const mem = process.memoryUsage();

        let dbStatus = 'Online 🟢';
        let lastGame = 'None';
        let activeGames = 0;

        try {
            const row = await db.get('SELECT title FROM posted_games ORDER BY posted_at DESC LIMIT 1');
            if (row) lastGame = row.title;

            const countRow = await db.get(
                `SELECT COUNT(*) AS count FROM posted_games
                 WHERE expires_at IS NULL OR expires_at > ?`,
                [Math.floor(Date.now() / 1000)],
            );
            activeGames = countRow?.count ?? 0;
        } catch (err) {
            dbStatus = 'Offline 🔴';
            console.error(err);
        }

        let topggServers = '—';
        if (topgg.isConfigured()) {
            const stats = await topgg.getStats();
            if (stats?.server_count != null) {
                topggServers = stats.server_count.toLocaleString();
            }
        }

        let redisStatus = 'Not configured';
        if (process.env.REDIS_URL) {
            redisStatus = redis.isAvailable ? 'Online 🟢' : 'Offline 🔴';
        }

        let broadcastStatus = 'Idle';
        if (broadcastService.isBroadcasting && broadcastService.state) {
            const { successCount, failCount } = broadcastService.state;
            broadcastStatus = `Running 📡 · ✅ ${successCount} · ❌ ${failCount}`;
        }

        const guildCount = client.guilds.cache.size;
        const memberCount = client.guilds.cache.reduce((total, guild) => total + (guild.memberCount ?? 0), 0);
        const channelCount = client.channels.cache.size;

        const shardId = client.shard?.ids?.join(', ') ?? '0';
        const shardCount = client.shard?.count ?? 1;

        const apiLatency = Date.now() - started;
        const wsPing = client.ws.ping;

        const loadAvg = os.loadavg().map((n) => n.toFixed(2)).join(' · ');
        const freeMem = formatBytes(os.freemem());
        const totalMem = formatBytes(os.totalmem());
        const cpuModel = truncate((os.cpus()[0]?.model ?? 'Unknown').trim(), 80);

        const embed = new EmbedBuilder()
            .setTitle('📊 Advanced Bot Info')
            .setColor(0x3498db)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '🤖 Discord',
                    value: [
                        `**Servers:** ${guildCount.toLocaleString()}`,
                        `**Members:** ~${memberCount.toLocaleString()}`,
                        `**Channels:** ${channelCount.toLocaleString()}`,
                        `**Shard:** ${shardId} / ${shardCount}`,
                        `**WS ping:** ${wsPing}ms`,
                        `**API latency:** ${apiLatency}ms`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '⚙️ Process',
                    value: [
                        `**PID:** ${process.pid}`,
                        `**Uptime:** ${formatUptime(process.uptime())}`,
                        `**Node:** ${process.version}`,
                        `**discord.js:** v${djsVersion}`,
                        `**Platform:** ${process.platform} (${process.arch})`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '🧠 Memory',
                    value: [
                        `**RSS:** ${formatBytes(mem.rss)}`,
                        `**Heap used:** ${formatBytes(mem.heapUsed)}`,
                        `**Heap total:** ${formatBytes(mem.heapTotal)}`,
                        `**External:** ${formatBytes(mem.external)}`,
                        `**Array buffers:** ${formatBytes(mem.arrayBuffers ?? 0)}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '🖥️ Host',
                    value: [
                        `**OS:** ${os.type()} ${os.release()}`,
                        `**CPU:** ${cpuModel}`,
                        `**Cores:** ${os.cpus().length}`,
                        `**Load (1/5/15m):** ${loadAvg}`,
                        `**RAM free:** ${freeMem} / ${totalMem}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: '🔧 CPU (process)',
                    value: formatCpuUsage(process.cpuUsage()),
                    inline: true,
                },
                {
                    name: '🗄️ Services',
                    value: [
                        `**Database:** ${dbStatus}`,
                        `**Active games:** ${activeGames}`,
                        `**Redis:** ${redisStatus}`,
                        `**Top.gg:** ${topggServers}`,
                        `**Broadcast:** ${broadcastStatus}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '🎮 Last posted game',
                    value: truncate(lastGame, 256),
                    inline: false,
                },
            )
            .setFooter({ text: 'No-Cost', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
