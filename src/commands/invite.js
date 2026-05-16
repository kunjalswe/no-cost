const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1504853562801524856&scope=bot&permissions=137439266880';
const SUPPORT_URL = 'https://discord.gg/yarZZ5zeNP';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get the invite link for No-Cost bot and join our support server.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📨 Invite No-Cost Bot')
            .setDescription(
                'Add **No-Cost** to your server and start receiving free game notifications instantly!\n\n' +
                '> 🎮 Tracks Steam & Epic Games free offers\n' +
                '> 📢 Auto-broadcasts to your configured channel\n' +
                '> ⏰ Automatic expiry cleanup\n\n' +
                'Need help? Join our **Support Server** and we\'ll get you sorted.'
            )
            .setFooter({ text: 'No-Cost', iconURL: interaction.client.user.displayAvatarURL() });

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

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    },
};
