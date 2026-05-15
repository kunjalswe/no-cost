const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('../database');
const { buildGameEmbed } = require('../utils/embedBuilder');
const { isAuthorized } = require('../utils/permissions');
const { getFutureUnixTimestamp } = require('../utils/timeParser');

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
        if (!isAuthorized(interaction.user.id)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const title = interaction.options.getString('title');
        const platform = interaction.options.getString('platform');
        const description = interaction.options.getString('description');
        const url = interaction.options.getString('url');
        const image = interaction.options.getString('image');
        const expiryStr = interaction.options.getString('expiry');

        let expiresAt = null;
        let displayExpiry = expiryStr;
        if (expiryStr) {
            expiresAt = getFutureUnixTimestamp(expiryStr);
            if (expiresAt) {
                displayExpiry = `<t:${expiresAt}:F> (<t:${expiresAt}:R>)`;
            }
        }

        const db = getDB();

        // 1. Save to database
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

        // 2. Broadcast
        const embed = buildGameEmbed({ title, description, platform, url, image_url: image, expiry: displayExpiry });
        
        const components = [];
        if (url) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Get Game')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
            );
            components.push(row);
        }
        
        let settings;
        try {
            settings = await db.all('SELECT * FROM guild_settings');
        } catch (error) {
            console.error('Error fetching settings:', error);
            return interaction.editReply('Failed to fetch guild settings.');
        }
        
        let successCount = 0;
        let failCount = 0;

        const batchSize = 10;
        for (let i = 0; i < settings.length; i += batchSize) {
            const batch = settings.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (setting) => {
                if (setting.platform !== 'both' && platform !== 'both' && setting.platform !== platform) {
                    return; 
                }

                try {
                    const guild = interaction.client.guilds.cache.get(setting.guild_id);
                    if (!guild) return;

                    const channel = guild.channels.cache.get(setting.channel_id);
                    if (!channel) return;

                    await channel.send({ embeds: [embed], components });
                    successCount++;
                } catch (error) {
                    console.error(`Failed to send to guild ${setting.guild_id}:`, error);
                    failCount++;
                }
            }));
            
            // Ratelimit delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        await interaction.editReply(`Game broadcasted successfully!\nSent to: **${successCount}** servers.\nFailed: **${failCount}** servers.`);
    },
};
