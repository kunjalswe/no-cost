const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getDB } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure the channel and platform filter for No-Cost notifications.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send free game notifications to')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Which platform deals to receive')
                .setRequired(true)
                .addChoices(
                    { name: 'Both (Steam & Epic)', value: 'both' },
                    { name: 'Epic Games Only', value: 'epic' },
                    { name: 'Steam Only', value: 'steam' }
                )),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const platform = interaction.options.getString('platform');
        const guildId = interaction.guild.id;

        const db = getDB();

        try {
            await db.run(
                `INSERT INTO guild_settings (guild_id, channel_id, platform)
                 VALUES (?, ?, ?)
                 ON CONFLICT(guild_id) DO UPDATE SET
                 channel_id=excluded.channel_id,
                 platform=excluded.platform`,
                [guildId, channel.id, platform]
            );

            await interaction.reply({
                content: `Successfully configured! Notifications for **${platform}** will be sent to <#${channel.id}>.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in /setup command:', error);
            await interaction.reply({
                content: 'There was an error saving the configuration to the database.',
                ephemeral: true
            });
        }
    },
};
