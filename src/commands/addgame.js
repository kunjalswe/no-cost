const { SlashCommandBuilder } = require('discord.js');
const { getDB } = require('../database');
const { isAuthorized } = require('../utils/permissions');
const { getFutureUnixTimestamp } = require('../utils/timeParser');
const broadcastService = require('../utils/broadcastService');
const { logAudit } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addgame')
        .setDescription('Post a new free game notification.')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The name of the free game')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Platform (steam, epic, both)')
                .setRequired(true)
                .addChoices(
                    { name: 'Post Steam', value: 'steam' },
                    { name: 'Post Epic', value: 'epic' },
                    { name: 'Post Both', value: 'both' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the game')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Link to get the game')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Image URL for the embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('expiry')
                .setDescription('When the offer expires')
                .setRequired(false)),
    async execute(interaction) {
        console.log(`[/addgame] Received request from ${interaction.user.tag}`);
        try {
            await interaction.deferReply({ flags: [64] });
            console.log('[/addgame] Reply deferred.');

            if (!isAuthorized(interaction)) {
                console.log('[/addgame] Unauthorized attempt.');
                logAudit(interaction.client, `🚫 Unauthorized /addgame attempt by **${interaction.user.tag}** (${interaction.user.id})`);
                return interaction.editReply('You do not have permission to use this command.');
            }

            const title = interaction.options.getString('title').trim();
            const platform = interaction.options.getString('platform');
            const description = interaction.options.getString('description')?.trim();
            const url = interaction.options.getString('url')?.trim();
            const image = interaction.options.getString('image')?.trim();
            const expiryStr = interaction.options.getString('expiry')?.trim();

            console.log(`[/addgame] Processing: ${title} (${platform})`);

            // 1. Validation
            if (title.length < 2) return interaction.editReply('Title is too short.');
            
            const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
            if (url && !urlRegex.test(url)) return interaction.editReply('Invalid URL format.');
            if (image && !urlRegex.test(image)) return interaction.editReply('Invalid Image URL format.');

            let expiresAt = null;
            let displayExpiry = expiryStr;
            if (expiryStr) {
                expiresAt = getFutureUnixTimestamp(expiryStr);
                if (expiresAt) {
                    displayExpiry = `<t:${expiresAt}:F> (<t:${expiresAt}:R>)`;
                }
            }

            const db = getDB();

            // 2. Idempotency Check
            if (url) {
                const existing = await db.get('SELECT id FROM posted_games WHERE url = ? AND title = ?', [url, title]);
                if (existing) {
                    return interaction.editReply('⚠️ This game has already been posted.');
                }
            }

            console.log('[/addgame] Saving to DB...');
            await db.run(
                `INSERT INTO posted_games (title, platform, description, url, image_url, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [title, platform, description, url, image, expiresAt]
            );

            console.log('[/addgame] Sending final response...');
            await interaction.editReply(`✅ Game saved and broadcast started!\nNotifications are being sent to servers in the background.`);
            
            console.log('[/addgame] Launching broadcast in background...');
            // 4. Delegate Broadcast (We don't await this to ensure the interaction finishes instantly)
            broadcastService.startBroadcast(interaction.client, {
                title, platform, description, url, image_url: image, displayExpiry
            }).catch(err => {
                console.error('[Broadcast] Background startup error:', err);
            });

            logAudit(interaction.client, `🆕 **${interaction.user.tag}** added a new game: **${title}** (${platform})`);
            console.log('[/addgame] Interaction handled.');
        } catch (error) {
            console.error('Error in /addgame:', error);
            if (interaction.deferred) {
                await interaction.editReply(`❌ An error occurred while processing the command: ${error.message}`);
            } else {
                await interaction.reply({ content: `❌ An error occurred: ${error.message}`, flags: [64] });
            }
        }
    },
};
