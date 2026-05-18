const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TOPGG_VOTE_URL = 'https://top.gg/bot/1504853562801524856/vote';
const DBL_VOTE_URL = 'https://discordbotlist.com/bots/no-cost/upvote';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for No-Cost on Top.gg and Discord Bot List.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('Vote No-Cost Now!')
            .setDescription('Click below buttons to vote our bot.')
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
