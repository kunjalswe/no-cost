const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getDB } = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure or remove No-Cost notification settings for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the channel and platform filter for free game notifications.')
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
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove this server\'s notification configuration.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const db = getDB();

        // ── /setup set ─────────────────────────────────────────────────────────
        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            const platform = interaction.options.getString('platform');

            try {
                await db.run(
                    `INSERT INTO guild_settings (guild_id, channel_id, platform)
                     VALUES (?, ?, ?)
                     ON CONFLICT(guild_id) DO UPDATE SET
                     channel_id = excluded.channel_id,
                     platform   = excluded.platform`,
                    [guildId, channel.id, platform]
                );

                await interaction.reply({
                    content: `✅ Configuration saved! **${platform}** notifications will be sent to <#${channel.id}>.`,
                    ephemeral: true,
                });
            } catch (error) {
                console.error('Error in /setup set:', error);
                await interaction.reply({
                    content: '❌ There was an error saving the configuration. Please try again.',
                    ephemeral: true,
                });
            }
        }

        // ── /setup remove ──────────────────────────────────────────────────────
        if (subcommand === 'remove') {
            try {
                const existing = await db.get(
                    'SELECT guild_id FROM guild_settings WHERE guild_id = ?',
                    [guildId]
                );

                if (!existing) {
                    return interaction.reply({
                        content: '⚠️ This server has no saved configuration to remove.',
                        ephemeral: true,
                    });
                }

                await db.run(
                    'DELETE FROM guild_settings WHERE guild_id = ?',
                    [guildId]
                );

                await interaction.reply({
                    content: '🗑️ Configuration removed. This server will no longer receive free game notifications.',
                    ephemeral: true,
                });
            } catch (error) {
                console.error('Error in /setup remove:', error);
                await interaction.reply({
                    content: '❌ There was an error removing the configuration. Please try again.',
                    ephemeral: true,
                });
            }
        }
    },
};
