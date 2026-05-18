const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const topgg = require('../utils/topgg');

const TOPGG_BOT_URL = 'https://top.gg/bot/1504853562801524856';
const TOPGG_VOTE_URL = `${TOPGG_BOT_URL}/vote`;
const DBL_VOTE_URL = 'https://discordbotlist.com/bots/no-cost/upvote';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for No-Cost on Top.gg and Discord Bot List.'),

    async execute(interaction) {
        let description = 'Click below buttons to vote our bot.';

        if (topgg.isConfigured()) {
            const stats = await topgg.getStats();
            if (stats?.server_count != null) {
                description += `\n\n<:topgg:1505772491984081060> **${stats.server_count.toLocaleString()}** servers on [Top.gg](${TOPGG_BOT_URL})`;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('Vote No-Cost Now!')
            .setDescription(description)
            .setFooter({ text: 'No-Cost', iconURL: interaction.client.user.displayAvatarURL() });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Top.gg')
                .setStyle(ButtonStyle.Link)
                .setURL(TOPGG_VOTE_URL)
                .setEmoji({ id: '1505772491984081060', name: 'topgg' }),
            new ButtonBuilder()
                .setLabel('Discord Bot List')
                .setStyle(ButtonStyle.Link)
                .setURL(DBL_VOTE_URL)
                .setEmoji({ id: '1505774008321441832', name: 'dbl' }),
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
