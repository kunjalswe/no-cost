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
} = require('discord.js');
const { getDB } = require('../database');
const { buildGameEmbed } = require('../utils/embedBuilder');
const { sendChannelMessage } = require('../utils/rateLimiter');
const redis = require('../utils/redisClient');

const PLATFORM_LABELS = { both: 'Both', steam: 'Steam', epic: 'Epic' };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Manage No-Cost notification settings via an interactive GUI.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        const db = getDB();
        const guildId = interaction.guild.id;

        let selectedChannel = null;
        let selectedPlatform = null;

        const formatConfigStatus = () => {
            const channelLine = selectedChannel
                ? `**Channel:** <#${selectedChannel}>`
                : '**Channel:** *not selected*';
            const platformLine = selectedPlatform
                ? `**Platform:** ${PLATFORM_LABELS[selectedPlatform] || selectedPlatform}`
                : '**Platform:** *not selected*';
            return `${channelLine}\n${platformLine}`;
        };

        const renderAddEditForm = () => ({
            content: `### 🛠️ Add or Edit Platform Configuration\n${formatConfigStatus()}\n\nSelect a channel and platform below.`,
            embeds: [],
            components: [
                new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('select_channel')
                        .setPlaceholder('1. Choose a notification channel')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
                ),
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_platform')
                        .setPlaceholder('2. Choose a platform')
                        .addOptions([
                            { label: 'Both (Steam & Epic)', value: 'both', emoji: '🎮', description: 'Receive all free game notifications' },
                            { label: 'Steam Only', value: 'steam', emoji: '💨', description: 'Only Steam notifications' },
                            { label: 'Epic Games Only', value: 'epic', emoji: '🎁', description: 'Only Epic Games notifications' },
                        ]),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('save_config')
                        .setLabel('Save Configuration')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('back_to_dash')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary),
                ),
            ],
        });

        const renderDashboard = async () => {
            const settings = await db.all('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Notification Setup Dashboard')
                .setDescription('Configure which channels receive free game notifications for each platform.')
                .setColor(0x3498db)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'No-Cost Configuration', iconURL: interaction.client.user.displayAvatarURL() });

            if (settings.length === 0) {
                embed.addFields({ name: 'Channels', value: 'No notification channels configured yet.' });
            } else {
                const settingsList = settings
                    .map((s) => `• **${s.platform.toUpperCase()}**: <#${s.channel_id}>`)
                    .join('\n');
                embed.addFields({ name: 'Channels', value: settingsList });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_add')
                    .setLabel('Add/Edit Platform')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('setup_remove_all')
                    .setLabel('Remove All')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
                    .setDisabled(settings.length === 0),
            );

            return { content: null, embeds: [embed], components: [row] };
        };

        const loadExistingForPlatform = async (platform) => {
            const existing = await db.get(
                'SELECT channel_id FROM guild_settings WHERE guild_id = ? AND platform = ?',
                [guildId, platform],
            );
            if (existing) {
                selectedChannel = existing.channel_id;
            }
        };

        const initialDashboard = await renderDashboard();
        const mainMessage = await interaction.reply({ ...initialDashboard, flags: [64] });

        const collector = mainMessage.createMessageComponentCollector({
            time: 300000,
        });

        collector.on('collect', async (i) => {
            if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return i.reply({ content: 'You do not have permission to use this.', flags: [64] });
            }

            if (i.customId === 'setup_add') {
                selectedChannel = null;
                selectedPlatform = null;
                await i.update(renderAddEditForm());
            }

            else if (i.customId === 'select_channel') {
                selectedChannel = i.values[0];
                await i.update(renderAddEditForm());
            }

            else if (i.customId === 'select_platform') {
                selectedPlatform = i.values[0];
                await loadExistingForPlatform(selectedPlatform);
                await i.update(renderAddEditForm());
            }

            else if (i.customId === 'save_config') {
                if (!selectedChannel || !selectedPlatform) {
                    return i.reply({
                        content: '⚠️ Please select **both** a channel and a platform before saving.',
                        flags: [64],
                    });
                }

                try {
                    await db.run(
                        `INSERT INTO guild_settings (guild_id, channel_id, platform)
                         VALUES (?, ?, ?)
                         ON CONFLICT(guild_id, platform) DO UPDATE SET
                         channel_id = excluded.channel_id`,
                        [guildId, selectedChannel, selectedPlatform],
                    );

                    await redis.del(`guild:${guildId}`);
                    await redis.del(`channel:${guildId}:${selectedChannel}`);

                    const currentUnix = Math.floor(Date.now() / 1000);
                    const games = await db.all(
                        `SELECT * FROM posted_games 
                         WHERE (expires_at IS NULL OR expires_at > ?) 
                         AND (platform = ? OR platform = 'both' OR ? = 'both')`,
                        [currentUnix, selectedPlatform, selectedPlatform],
                    );

                    if (games.length > 0) {
                        const channel = interaction.guild.channels.cache.get(selectedChannel);
                        if (channel) {
                            for (const game of games) {
                                const displayExpiry = game.expires_at
                                    ? `<t:${game.expires_at}:F> (<t:${game.expires_at}:R>)`
                                    : 'N/A';
                                const embed = buildGameEmbed({
                                    title: game.title,
                                    description: game.description,
                                    platform: game.platform,
                                    url: game.url,
                                    image_url: game.image_url,
                                    expiry: displayExpiry,
                                    iconURL: interaction.client.user.displayAvatarURL(),
                                });

                                const components = [];
                                if (game.url) {
                                    components.push(
                                        new ActionRowBuilder().addComponents(
                                            new ButtonBuilder()
                                                .setLabel('Get Game')
                                                .setStyle(ButtonStyle.Link)
                                                .setURL(game.url),
                                        ),
                                    );
                                }
                                await sendChannelMessage(channel, { embeds: [embed], components }).catch(console.error);
                            }
                        }
                    }

                    const updatedDash = await renderDashboard();
                    await i.update({
                        content: `✅ **${PLATFORM_LABELS[selectedPlatform]}** → <#${selectedChannel}>`,
                        ...updatedDash,
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
            } catch {
                // Ignore if message was deleted
            }
        });
    },
};
