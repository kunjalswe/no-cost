const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { isAuthorized } = require('../utils/permissions');

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1504853562801524856&scope=bot&permissions=137439266880';
const SUPPORT_URL = 'https://discord.gg/yarZZ5zeNP';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows available commands for the No-Cost bot.'),
    async execute(interaction) {
        const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
        const isDev = isAuthorized(interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle('No-Cost Bot — Help Menu')
            .setDescription('Here are the available commands based on your permissions:')
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: 'No-Cost' });

        // Everyone
        embed.addFields({
            name: '📢 Public Commands',
            value: '`/free` - Browse active free games\n`/status` - Shows bot uptime and stats\n`/ping` - Check bot latency\n`/invite` - Get the bot invite & support server link\n`/help` - Shows this menu'
        });

        // Admin
        if (hasAdmin) {
            embed.addFields({
                name: '🔧 Admin Commands',
                value: '`/setup set` - Configure the notification channel and platform filter\n`/setup remove` - Remove this server\'s notification configuration'
            });
        }

        // Dev
        if (isDev) {
            embed.addFields({
                name: '⚙️ Developer Commands',
                value: '`/addgame` - Broadcast a new free game to all configured servers\n`/removegame` - Remove a game from the database'
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('➕  Invite Bot')
                .setStyle(ButtonStyle.Link)
                .setURL(INVITE_URL),
            new ButtonBuilder()
                .setLabel('💬  Support Server')
                .setStyle(ButtonStyle.Link)
                .setURL(SUPPORT_URL)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};

