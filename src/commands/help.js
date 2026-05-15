const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAuthorized } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows available commands for the No-Cost bot.'),
    async execute(interaction) {
        const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
        const isDev = isAuthorized(interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('No-Cost Bot Help Menu')
            .setDescription('Here are the available commands based on your permissions:')
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: 'No-Cost Deals Bot' });

        // Everyone
        embed.addFields({ name: 'Public Commands', value: '`/free` - Browse active free games\n`/status` - Shows bot uptime and stats\n`/ping` - Check bot latency\n`/help` - Shows this menu' });

        // Admin
        if (hasAdmin) {
            embed.addFields({ name: 'Admin Commands', value: '`/setup set` - Configure the notification channel and platform filter\n`/setup remove` - Remove this server\'s notification configuration' });
        }

        // Dev
        if (isDev) {
            embed.addFields({ name: 'Developer Commands', value: '`/addgame` - Broadcast a new free game to all configured servers' });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
