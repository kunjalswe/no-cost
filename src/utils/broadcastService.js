const fs = require('fs');
const path = require('path');
const { getDB } = require('../database');
const { buildGameEmbed } = require('./embedBuilder');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const redis = require('./redisClient');

const STATE_FILE = path.join(__dirname, '../../broadcast_state.json');

class BroadcastService {
    constructor() {
        this.isBroadcasting = false;
        this.state = this.loadState();
    }

    loadState() {
        if (fs.existsSync(STATE_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            } catch (e) {
                console.error('Failed to load broadcast state:', e);
            }
        }
        return null;
    }

    saveState(state) {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }

    clearState() {
        if (fs.existsSync(STATE_FILE)) {
            try {
                fs.unlinkSync(STATE_FILE);
            } catch (e) {
                // Ignore
            }
        }
        this.state = null;
    }

    async startBroadcast(client, gameData) {
        if (this.isBroadcasting) return { success: false, message: 'A broadcast is already in progress.' };
        
        this.isBroadcasting = true;
        this.state = {
            game: gameData,
            lastGuildId: null,
            successCount: 0,
            failCount: 0,
            startTime: Date.now()
        };
        this.saveState(this.state);

        // Start the process in the background
        this.processBroadcast(client);
        return { success: true, message: 'Broadcast started.' };
    }

    async processBroadcast(client) {
        const db = getDB();
        
        while (this.isBroadcasting) {
            const { game } = this.state;
            
            // 1. Embed Cache (Requirement 4)
            const embedCacheKey = `embed:${game.id || game.title.replace(/\s+/g, '_')}:${game.platform}`;
            let cachedEmbedData = await redis.get(embedCacheKey);
            
            let embed, components;
            if (cachedEmbedData) {
                console.log(`[Redis] Embed cache HIT for ${game.title}`);
                embed = cachedEmbedData.embed;
                components = cachedEmbedData.components.map(row => ActionRowBuilder.from(row));
            } else {
                console.log(`[Redis] Embed cache MISS for ${game.title}. Building...`);
                const embedObj = buildGameEmbed({ 
                    title: game.title, 
                    description: game.description, 
                    platform: game.platform, 
                    url: game.url, 
                    image_url: game.image_url, 
                    expiry: game.displayExpiry,
                    iconURL: client.user.displayAvatarURL()
                });
                
                embed = embedObj.toJSON();
                components = [];
                if (game.url) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel('Get Game').setStyle(ButtonStyle.Link).setURL(game.url)
                    ));
                }
                
                // Cache for 24h
                await redis.set(embedCacheKey, { embed, components: components.map(c => c.toJSON()) }, 86400);
            }

            let hasMore = true;
            const BATCH_SIZE = 50;
            const sentGuildsInThisBroadcast = new Set();

            while (hasMore) {
                // Fetch guild IDs in batches to minimize DB load (Requirement 2)
                let query = 'SELECT guild_id FROM guild_settings ';
                let params = [];
                if (this.state.lastGuildId) {
                    query += 'WHERE guild_id > ? ';
                    params.push(this.state.lastGuildId);
                }
                query += 'GROUP BY guild_id ORDER BY guild_id ASC LIMIT ?';
                params.push(BATCH_SIZE);

                let idBatch;
                try {
                    idBatch = await db.all(query, params);
                } catch (error) {
                    console.error('Database error during broadcast:', error);
                    this.isBroadcasting = false;
                    return;
                }

                if (idBatch.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const { guild_id } of idBatch) {
                    // Duplicate prevention
                    if (sentGuildsInThisBroadcast.has(guild_id)) {
                        this.state.lastGuildId = guild_id;
                        continue;
                    }

                    try {
                        // 2. Guild Settings Cache (Requirement 2)
                        const guildCacheKey = `guild:${guild_id}`;
                        let guildConfigs = await redis.get(guildCacheKey);
                        
                        if (guildConfigs) {
                            console.log(`[Redis] Guild settings HIT for ${guild_id}`);
                        } else {
                            console.log(`[Redis] Guild settings MISS for ${guild_id}. Fetching from DB...`);
                            guildConfigs = await db.all('SELECT * FROM guild_settings WHERE guild_id = ?', [guild_id]);
                            if (guildConfigs && guildConfigs.length > 0) {
                                await redis.set(guildCacheKey, guildConfigs, 3600); // 60 min TTL
                            }
                        }

                        if (!guildConfigs || guildConfigs.length === 0) {
                            this.state.lastGuildId = guild_id;
                            continue;
                        }

                        for (const setting of guildConfigs) {
                            // Platform filter
                            if (setting.platform !== 'both' && game.platform !== 'both' && setting.platform !== game.platform) {
                                continue; 
                            }

                            // 3. Channel Resolution Cache (Requirement 3)
                            const channelCacheKey = `channel:${guild_id}:${setting.channel_id}`;
                            let isChannelValid = await redis.get(channelCacheKey);

                            let channel = null;
                            if (isChannelValid === null) {
                                // Cache miss or unknown state
                                console.log(`[Redis] Channel cache MISS for ${setting.channel_id}`);
                                try {
                                    const guild = client.guilds.cache.get(guild_id) || await client.guilds.fetch(guild_id).catch(() => null);
                                    if (guild) {
                                        channel = guild.channels.cache.get(setting.channel_id) || await guild.channels.fetch(setting.channel_id).catch(() => null);
                                    }
                                    
                                    if (channel && channel.isTextBased()) {
                                        // Cache minimal metadata or just true to indicate validity
                                        await redis.set(channelCacheKey, { id: channel.id, valid: true }, 1800); // 30 min TTL
                                    } else {
                                        await redis.set(channelCacheKey, { valid: false }, 600); // 10 min TTL for invalid
                                    }
                                } catch (e) {
                                    await redis.set(channelCacheKey, { valid: false }, 600);
                                }
                            } else if (isChannelValid.valid) {
                                // Cache hit and valid
                                console.log(`[Redis] Channel cache HIT for ${setting.channel_id}`);
                                channel = client.channels.cache.get(setting.channel_id) || await client.channels.fetch(setting.channel_id).catch(() => null);
                            }

                            if (!channel) continue;

                            await channel.send({ embeds: [embed], components });
                            this.state.successCount++;
                            sentGuildsInThisBroadcast.add(guild_id);
                        }
                    } catch (error) {
                        this.state.failCount++;
                    }

                    this.state.lastGuildId = guild_id;
                }

                this.saveState(this.state);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            hasMore = false;
            this.isBroadcasting = false;
        }

        console.log(`Broadcast finished. Success: ${this.state.successCount}, Fail: ${this.state.failCount}`);
        this.clearState();
    }

    async resumeIfPending(client) {
        if (this.state && !this.isBroadcasting) {
            console.log('Resuming pending broadcast...');
            this.isBroadcasting = true;
            this.processBroadcast(client);
        }
    }
}

module.exports = new BroadcastService();
