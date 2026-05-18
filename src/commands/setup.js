const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ComponentType
} = require('discord.js');
const { getDB } = require('../database');
const { buildGameEmbed } = require('../utils/embedBuilder');
const { getPingRoleId, formatPingContent, pingAllowedMentions } = require('../utils/guildSettings');
const redis = require('../utils/redisClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Manage No-Cost notification settings via an interactive GUI.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        const db = getDB();
        const guildId = interaction.guild.id;

        // Function to generate the main dashboard
        const renderDashboard = async () => {
            const settings = await db.all('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
            const pingRoleId = await getPingRoleId(db, guildId);

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Notification Setup Dashboard')
                .setDescription('Configure which channels receive free game notifications for each platform.')
                .setColor(0x3498db)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'No-Cost Configuration', iconURL: interaction.client.user.displayAvatarURL() });

            embed.addFields({
                name: '🔔 Ping Role',
                value: pingRoleId ? `<@&${pingRoleId}>` : 'Not set — use **Ping Role** to choose who gets mentioned.',
            });

            if (settings.length === 0) {
                embed.addFields({ name: 'Channels', value: 'No notification channels configured yet.' });
            } else {
                const settingsList = settings.map(s => `• **${s.platform.toUpperCase()}**: <#${s.channel_id}>`).join('\n');
                embed.addFields({ name: 'Channels', value: settingsList });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_add')
                    .setLabel('Add/Edit Platform')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('setup_ping_role')
                    .setLabel('Ping Role')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔔'),
                new ButtonBuilder()
                    .setCustomId('setup_remove_all')
                    .setLabel('Remove All')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
                    .setDisabled(settings.length === 0 && !pingRoleId)
            );

            return { content: null, embeds: [embed], components: [row] };
        };

        const initialDashboard = await renderDashboard();
        const mainMessage = await interaction.reply({ ...initialDashboard, flags: [64] });

        // Main collector for the dashboard buttons
        const collector = mainMessage.createMessageComponentCollector({
            time: 300000 // 5 minutes
        });

        // State for the configuration flow
        let selectedChannel = null;
        let selectedPlatform = null;

        collector.on('collect', async (i) => {
            // Re-verify permission just in case
            if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return i.reply({ content: 'You do not have permission to use this.', flags: [64] });
            }

            if (i.customId === 'setup_ping_role') {
                const pingRoleId = await getPingRoleId(db, guildId);

                const roleSelect = new RoleSelectMenuBuilder()
                    .setCustomId('select_ping_role')
                    .setPlaceholder('Select a role to ping for notifications')
                    .setMinValues(1)
                    .setMaxValues(1);

                const row1 = new ActionRowBuilder().addComponents(roleSelect);
                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_dash')
                        .setLabel('Back')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('clear_ping_role')
                        .setLabel('Clear Ping Role')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔕')
                        .setDisabled(!pingRoleId),
                );

                await i.update({
                    content: '### 🔔 Ping Role\nChoose a role to mention when new free games are posted. Members can mute this role if they do not want pings.',
                    embeds: [],
                    components: [row1, row2],
                });
            }

            else if (i.customId === 'select_ping_role') {
                const roleId = i.values[0];

                try {
                    await db.run(
                        `INSERT INTO guild_ping_roles (guild_id, ping_role_id)
                         VALUES (?, ?)
                         ON CONFLICT(guild_id) DO UPDATE SET
                         ping_role_id = excluded.ping_role_id,
                         updated_at = CURRENT_TIMESTAMP`,
                        [guildId, roleId],
                    );

                    await redis.del(`guild:${guildId}`);

                    const updatedDash = await renderDashboard();
                    await i.update({
                        content: `✅ Ping role set to <@&${roleId}>.`,
                        ...updatedDash,
                    });
                } catch (error) {
                    console.error('Error saving ping role:', error);
                    await i.reply({ content: '❌ Failed to save ping role.', flags: [64] });
                }
            }

            else if (i.customId === 'clear_ping_role') {
                try {
                    await db.run('DELETE FROM guild_ping_roles WHERE guild_id = ?', [guildId]);
                    await redis.del(`guild:${guildId}`);

                    const updatedDash = await renderDashboard();
                    await i.update({
                        content: '🔕 Ping role cleared.',
                        ...updatedDash,
                    });
                } catch (error) {
                    console.error('Error clearing ping role:', error);
                    await i.reply({ content: '❌ Failed to clear ping role.', flags: [64] });
                }
            }

            else if (i.customId === 'setup_add') {
                selectedChannel = null;
                selectedPlatform = null;

                const channelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId('select_channel')
                    .setPlaceholder('1. Choose a notification channel')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

                const platformSelect = new StringSelectMenuBuilder()
                    .setCustomId('select_platform')
                    .setPlaceholder('2. Choose a platform')
                    .addOptions([
                        { label: 'Both (Steam & Epic)', value: 'both', emoji: '🎮', description: 'Receive all free game notifications' },
                        { label: 'Steam Only', value: 'steam', emoji: '💨', description: 'Only Steam notifications' },
                        { label: 'Epic Games Only', value: 'epic', emoji: '🎁', description: 'Only Epic Games notifications' },
                    ]);

                const row1 = new ActionRowBuilder().addComponents(channelSelect);
                const row2 = new ActionRowBuilder().addComponents(platformSelect);
                const row3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('save_config')
                        .setLabel('Save Configuration')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('back_to_dash')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

                await i.update({
                    content: '### 🛠️ Add or Edit Platform Configuration\nPlease select a channel and a platform below.',
                    embeds: [],
                    components: [row1, row2, row3],
                });
            }

            else if (i.customId === 'select_channel') {
                selectedChannel = i.values[0];
                await i.deferUpdate();
            }

            else if (i.customId === 'select_platform') {
                selectedPlatform = i.values[0];
                await i.deferUpdate();
            }

            else if (i.customId === 'save_config') {
                if (!selectedChannel || !selectedPlatform) {
                    return i.reply({ content: '⚠️ Please select **both** a channel and a platform before saving.', flags: [64] });
                }

                try {
                    await db.run(
                        `INSERT INTO guild_settings (guild_id, channel_id, platform)
                         VALUES (?, ?, ?)
                         ON CONFLICT(guild_id, platform) DO UPDATE SET
                         channel_id = excluded.channel_id`,
                        [guildId, selectedChannel, selectedPlatform]
                    );

                    // Invalidate Cache (Requirement 2)
                    await redis.del(`guild:${guildId}`);
                    await redis.del(`channel:${guildId}:${selectedChannel}`);

                    // --- Automatically send non-expired games to the new channel ---
                    const currentUnix = Math.floor(Date.now() / 1000);
                    const games = await db.all(
                        `SELECT * FROM posted_games 
                         WHERE (expires_at IS NULL OR expires_at > ?) 
                         AND (platform = ? OR platform = 'both' OR ? = 'both')`,
                        [currentUnix, selectedPlatform, selectedPlatform]
                    );

                    if (games.length > 0) {
                        const channel = interaction.guild.channels.cache.get(selectedChannel);
                        const pingRoleId = await getPingRoleId(db, guildId);
                        if (channel) {
                            for (const game of games) {
                                const displayExpiry = game.expires_at ? `<t:${game.expires_at}:F> (<t:${game.expires_at}:R>)` : 'N/A';
                                const embed = buildGameEmbed({
                                    title: game.title,
                                    description: game.description,
                                    platform: game.platform,
                                    url: game.url,
                                    image_url: game.image_url,
                                    expiry: displayExpiry,
                                    iconURL: interaction.client.user.displayAvatarURL()
                                });

                                const components = [];
                                if (game.url) {
                                    const row = new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                            .setLabel('Get Game')
                                            .setStyle(ButtonStyle.Link)
                                            .setURL(game.url)
                                    );
                                    components.push(row);
                                }
                                await channel.send({
                                    content: formatPingContent(pingRoleId),
                                    embeds: [embed],
                                    components,
                                    allowedMentions: pingAllowedMentions(pingRoleId),
                                }).catch(console.error);
                            }
                        }
                    }
                    // -------------------------------------------------------------

                    const updatedDash = await renderDashboard();
                    await i.update({
                        content: `✅ Successfully configured **${selectedPlatform}** notifications for <#${selectedChannel}>!`,
                        ...updatedDash
                    });
                } catch (error) {
                    console.error('Error saving config:', error);
                    await i.reply({ content: '❌ Failed to save configuration.', flags: [64] });
                }
            }

            else if (i.customId === 'back_to_dash') {
                const dash = await renderDashboard();
                await i.update(dash);
            }

            else if (i.customId === 'setup_remove_all') {
                try {
                    await db.run('DELETE FROM guild_settings WHERE guild_id = ?', [guildId]);
                    await db.run('DELETE FROM guild_ping_roles WHERE guild_id = ?', [guildId]);

                    // Invalidate Cache (Requirement 2)
                    await redis.del(`guild:${guildId}`);

                    const updatedDash = await renderDashboard();
                    await i.update({ content: '🗑️ All configurations have been removed.', ...updatedDash });
                } catch (error) {
                    console.error('Error removing configs:', error);
                    await i.reply({ content: '❌ Failed to remove configurations.', flags: [64] });
                }
            }
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({ components: [] });
            } catch (e) {
                // Ignore if message was deleted
            }
        });
    },
};
