const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with the bot\'s current latency.'),
    async execute(interaction) {
        const sent = await interaction.deferReply({ fetchReply: true });

        const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const websocketLatency = interaction.client.ws.ping;

        // Measure Redis Latency
        const redis = require('../utils/redisClient');
        let redisLatency = 'Disconnected';
        if (redis.isAvailable && redis.client) {
            try {
                const start = Date.now();
                await redis.client.ping();
                redisLatency = `${Date.now() - start}ms`;
            } catch (e) {
                redisLatency = 'Error';
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'API Latency', value: `${roundTripLatency}ms`, inline: true },
                { name: 'Websocket Ping', value: `${websocketLatency}ms`, inline: true },
                { name: 'Redis Latency', value: redisLatency, inline: true }
            )
            .setColor(0x3498db)
            .setFooter({ text: 'No-Cost', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] });
    },
};
