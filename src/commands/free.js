const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../database');
const { buildGameEmbed } = require('../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('free')
        .setDescription('List currently active free games.')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Platform to filter by')
                .setRequired(false)
                .addChoices(
                    { name: 'Steam', value: 'steam' },
                    { name: 'Epic Games', value: 'epic' }
                )),
    async execute(interaction) {
        await interaction.deferReply();
        const platform = interaction.options.getString('platform');
        const db = getDB();

        const currentUnix = Math.floor(Date.now() / 1000);
        let query = `
            SELECT * FROM posted_games 
            WHERE (expires_at IS NULL OR expires_at > ?)
        `;
        const params = [currentUnix];

        if (platform) {
            query += ' AND (platform = ? OR platform = "both")';
            params.push(platform);
        }

        query += ' ORDER BY posted_at DESC LIMIT 10';

        try {
            const games = await db.all(query, params);

            if (games.length === 0) {
                return interaction.editReply('There are no active free games right now.');
            }

            const embeds = games.map(game => {
                let displayExpiry = undefined;
                if (game.expires_at) {
                    displayExpiry = `<t:${game.expires_at}:F> (<t:${game.expires_at}:R>)`;
                }

                return buildGameEmbed({
                    title: game.title,
                    description: game.description,
                    platform: game.platform,
                    url: game.url,
                    image_url: game.image_url,
                    expiry: displayExpiry
                });
            });

            await interaction.editReply({ embeds });
        } catch (error) {
            console.error('Error fetching free games:', error);
            await interaction.editReply('Failed to fetch free games from the database.');
        }
    },
};
