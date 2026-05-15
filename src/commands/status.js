const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Shows the current status and statistics of the No-Cost bot.'),
    async execute(interaction) {
        const db = getDB();
        
        let dbStatus = 'Online 🟢';
        let lastGame = 'None';
        let serverCount = interaction.client.guilds.cache.size;

        try {
            const row = await db.get('SELECT title FROM posted_games ORDER BY posted_at DESC LIMIT 1');
            if (row) {
                lastGame = row.title;
            }
        } catch (err) {
            dbStatus = 'Offline 🔴';
            console.error(err);
        }

        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const uptimeStr = `${days}d ${hours}h ${minutes}m`;

        const embed = new EmbedBuilder()
            .setTitle('Bot Status')
            .setColor(0x3498db)
            .addFields(
                { name: 'Uptime', value: uptimeStr, inline: true },
                { name: 'Servers', value: `${serverCount}`, inline: true },
                { name: 'Database', value: dbStatus, inline: true },
                { name: 'Last Posted Game', value: lastGame, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'No-Cost Deals Bot' });

        await interaction.reply({ embeds: [embed] });
    },
};
