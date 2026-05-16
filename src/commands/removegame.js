const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../database');
const { isAuthorized } = require('../utils/permissions');
const redis = require('../utils/redisClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removegame')
        .setDescription('Remove a game from the database.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Select the game to remove')
                .setRequired(true)
                .setAutocomplete(true)),

    /**
     * Autocomplete handler — called while the user is typing in the `game` option.
     * Returns up to 25 matching game titles from posted_games.
     */
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const db = getDB();

        try {
            const games = await db.all(
                `SELECT id, title, platform FROM posted_games ORDER BY posted_at DESC LIMIT 100`
            );

            const filtered = games
                .filter(g => g.title.toLowerCase().includes(focusedValue))
                .slice(0, 25)
                .map(g => ({
                    name: `${g.title} [${g.platform}] (ID: ${g.id})`,
                    value: String(g.id),
                }));

            await interaction.respond(filtered);
        } catch (error) {
            console.error('Autocomplete error in /removegame:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        if (!isAuthorized(interaction)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                flags: [64], // MessageFlags.Ephemeral is bit 64
            });
        }

        await interaction.deferReply({ flags: [64] });

        const gameId = interaction.options.getString('game');
        const db = getDB();

        // Fetch the game first so we can show its name in the confirmation
        let game;
        try {
            game = await db.get(`SELECT * FROM posted_games WHERE id = ?`, [gameId]);
        } catch (error) {
            console.error('Error fetching game for removal:', error);
            return interaction.editReply('❌ Failed to fetch the game from the database.');
        }

        if (!game) {
            return interaction.editReply('❌ Game not found in the database. It may have already been removed.');
        }

        // Delete the game
        try {
            await db.run(`DELETE FROM posted_games WHERE id = ?`, [gameId]);

            // Invalidate Embed Cache (Requirement 4)
            const embedCacheKey = `embed:${game.id || game.title.replace(/\s+/g, '_')}:${game.platform}`;
            await redis.del(embedCacheKey);
        } catch (error) {
            console.error('Error deleting game:', error);
            return interaction.editReply('❌ Failed to delete the game from the database.');
        }

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🗑️ Game Removed')
            .setDescription(`**${game.title}** has been removed from the database.`)
            .addFields(
                { name: 'Platform', value: game.platform, inline: true },
                { name: 'Game ID', value: String(game.id), inline: true },
            )
            .setFooter({ text: `Removed by ${interaction.user.tag}`, iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    },
};
