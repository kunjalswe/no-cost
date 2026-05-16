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
        if (!isAuthorized(interaction)) {
            await logAudit(interaction.client, `🚫 Unauthorized /addgame attempt by **${interaction.user.tag}** (${interaction.user.id})`);
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: [64]
            });
        }

        const title = interaction.options.getString('title').trim();
        const platform = interaction.options.getString('platform');
        const description = interaction.options.getString('description')?.trim();
        const url = interaction.options.getString('url')?.trim();
        const image = interaction.options.getString('image')?.trim();
        const expiryStr = interaction.options.getString('expiry')?.trim();

        // 1. Validation
        if (title.length < 2) return interaction.reply({ content: 'Title is too short.', flags: [64] });
        
        const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
        if (url && !urlRegex.test(url)) return interaction.reply({ content: 'Invalid URL format.', flags: [64] });
        if (image && !urlRegex.test(image)) return interaction.reply({ content: 'Invalid Image URL format.', flags: [64] });

        await interaction.deferReply({ flags: [64] });

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

        // 3. Save to database
        try {
            await db.run(
                `INSERT INTO posted_games (title, platform, description, url, image_url, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [title, platform, description, url, image, expiresAt]
            );
        } catch (error) {
            console.error('Error saving game:', error);
            return interaction.editReply('Failed to save the game to the database.');
        }

        // 4. Delegate Broadcast
        const result = await broadcastService.startBroadcast(interaction.client, {
            title, platform, description, url, image_url: image, displayExpiry
        });

        if (!result.success) {
            return interaction.editReply(`❌ ${result.message}`);
        }

        await logAudit(interaction.client, `🆕 **${interaction.user.tag}** added a new game: **${title}** (${platform})`);
        await interaction.editReply(`✅ Game saved and broadcast started!\nSent to the background for processing.`);
    },
};
