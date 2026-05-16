require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./database');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const slashCommandsData = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommandsData.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.once('clientReady', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    const updatePresence = () => {
        client.user.setActivity(`/help - ${client.guilds.cache.size} Servers`, { type: ActivityType.Watching });
    };

    updatePresence();
    client.on('guildCreate', updatePresence);
    client.on('guildDelete', updatePresence);

    // 1. Run initial cleanup on startup (Fixes: Cleanup race condition)
    const runCleanup = async () => {
        try {
            const db = require('./database').getDB();
            const currentUnix = Math.floor(Date.now() / 1000);
            const result = await db.run('DELETE FROM posted_games WHERE expires_at IS NOT NULL AND expires_at < ?', [currentUnix]);
            if (result.changes && result.changes > 0) {
                console.log(`[Cleanup] Deleted ${result.changes} expired game(s) from the database.`);
            }
        } catch (error) {
            console.error('Error cleaning up expired games:', error);
        }
    };

    await runCleanup();

    // 2. Resume any pending broadcast (Fixes: No crash recovery)
    const broadcastService = require('./utils/broadcastService');
    broadcastService.resumeIfPending(client);

    // Refresh presence every 10 seconds to prevent it from disappearing
    setInterval(updatePresence, 10 * 1000);

    // Register commands globally
    if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            console.log(`Started refreshing ${slashCommandsData.length} application (/) commands.`);
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: slashCommandsData },
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            console.error('Error registering application commands:', error);
        }
    } else {
        console.log('Skipping slash command registration because DISCORD_TOKEN or CLIENT_ID is missing.');
    }

    // Setup automatic cleanup of expired games interval
    setInterval(runCleanup, 60 * 1000); // Check every minute
});

// Initialize DB and login
(async () => {
    try {
        await initDB();
        
        // Auto-start in-memory Redis if configured or if connection to localhost fails
        // This is skipped if DISABLE_LOCAL_REDIS is set to true (useful for VPS)
        if (process.env.DISABLE_LOCAL_REDIS !== 'true' && process.env.REDIS_URL && (process.env.REDIS_URL.includes('localhost') || process.env.REDIS_URL.includes('127.0.0.1'))) {
            try {
                const redis = require('./utils/redisClient');
                
                // Wait a moment to see if it connects
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                if (!redis.isAvailable) {
                    console.log('[Redis] No external Redis server detected. Launching internal in-memory Redis...');
                    const { startLocalRedis } = require('./utils/localRedisRunner');
                    const memoryServer = await startLocalRedis();
                    if (memoryServer) {
                        redis.init();
                    }
                }
            } catch (err) {
                console.error('[Redis] Error during local Redis auto-start check:', err.message);
            }
        }

        if (process.env.DISCORD_TOKEN) {
            await client.login(process.env.DISCORD_TOKEN);
        } else {
            console.log('Bot token is not set in .env. Skipping Discord login.');
        }
    } catch (error) {
        console.error('Failed to start the bot:', error);
    }
})();

// Global Error Handlers for Production Deployment
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Anti-Crash] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[Anti-Crash] Uncaught Exception:', err);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.error('[Anti-Crash] Uncaught Exception Monitor:', err, origin);
});
