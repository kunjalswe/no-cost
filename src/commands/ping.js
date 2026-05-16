const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with the bot\'s current latency.'),
    async execute(interaction) {
        const sent = await interaction.deferReply({ fetchReply: true });
        
        const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const websocketLatency = interaction.client.ws.ping;

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'API Latency', value: `${roundTripLatency}ms`, inline: true },
                { name: 'Websocket Ping', value: `${websocketLatency}ms`, inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: 'No-Cost' });

        await interaction.editReply({ embeds: [embed] });
    },
};
