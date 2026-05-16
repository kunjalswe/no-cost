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
        const isDev = isAuthorized(interaction);

        const embed = new EmbedBuilder()
            .setTitle('🚀 No-Cost | Information Hub')
            .setDescription('Welcome to the No-Cost dashboard. Use the commands below to browse games or manage notifications.')
            .setColor(0x3498db)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: 'No-Cost', iconURL: interaction.client.user.displayAvatarURL() });

        // Everyone
        embed.addFields({
            name: '📢 Public Commands',
            value: '`/free` - Browse active free games\n`/status` - Shows bot uptime and stats\n`/ping` - Check bot latency\n`/invite` - Get the bot invite & support server link\n`/help` - Shows this menu'
        });

        // Admin
        if (hasAdmin) {
            embed.addFields({
                name: '🔧 Admin Commands',
                value: '`/setup` - Open the interactive notification setup dashboard\nManage platforms, channels, and removal in one place.'
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

        await interaction.reply({ embeds: [embed], components: [row], flags: [64] });
    },
};

