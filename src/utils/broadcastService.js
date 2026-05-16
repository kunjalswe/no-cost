const fs = require('fs');
const path = require('path');
const { getDB } = require('../database');
const { buildGameEmbed } = require('./embedBuilder');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
            const embed = buildGameEmbed({ 
                title: game.title, 
                description: game.description, 
                platform: game.platform, 
                url: game.url, 
                image_url: game.image_url, 
                expiry: game.displayExpiry,
                iconURL: client.user.displayAvatarURL()
            });

            const components = [];
            if (game.url) {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Get Game').setStyle(ButtonStyle.Link).setURL(game.url)
                ));
            }

            let hasMore = true;
            const BATCH_SIZE = 50;
            const sentGuildsInThisBroadcast = new Set();

            while (hasMore) {
                // 1. Performance: Paginated query using guild_id
                // 2. Duplicate Prevention: Order by platform DESC to prioritize specific (steam/epic) over 'both'
                let query = 'SELECT * FROM guild_settings ';
                let params = [];
                if (this.state.lastGuildId) {
                    query += 'WHERE guild_id > ? ';
                    params.push(this.state.lastGuildId);
                }
                query += 'ORDER BY guild_id ASC, platform DESC LIMIT ?';
                params.push(BATCH_SIZE);

                let batch;
                try {
                    batch = await db.all(query, params);
                } catch (error) {
                    console.error('Database error during broadcast:', error);
                    this.isBroadcasting = false;
                    return;
                }

                if (batch.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const setting of batch) {
                    // Duplicate prevention: One message per guild per broadcast
                    if (sentGuildsInThisBroadcast.has(setting.guild_id)) {
                        this.state.lastGuildId = setting.guild_id;
                        continue;
                    }

                    // Platform filter
                    if (setting.platform !== 'both' && game.platform !== 'both' && setting.platform !== game.platform) {
                        this.state.lastGuildId = setting.guild_id;
                        continue; 
                    }

                    try {
                        const guild = client.guilds.cache.get(setting.guild_id) || await client.guilds.fetch(setting.guild_id).catch(() => null);
                        if (!guild) {
                            this.state.lastGuildId = setting.guild_id;
                            continue;
                        }

                        const channel = guild.channels.cache.get(setting.channel_id) || await guild.channels.fetch(setting.channel_id).catch(() => null);
                        if (!channel || !channel.isTextBased()) {
                            this.state.lastGuildId = setting.guild_id;
                            continue;
                        }

                        await channel.send({ embeds: [embed], components });
                        this.state.successCount++;
                        sentGuildsInThisBroadcast.add(setting.guild_id);
                    } catch (error) {
                        this.state.failCount++;
                    }

                    this.state.lastGuildId = setting.guild_id;
                }

                this.saveState(this.state);
                
                // Ratelimit safety delay between batches
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
