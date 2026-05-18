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
const MAX_CONFIGS = 2;

async function respondToComponent(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }
        return await interaction.update(payload);
    } catch (error) {
        if (error?.code === 10062 && interaction.message?.editable) {
            return await interaction.message.edit(payload);
        }
        throw error;
    }
}

async function backfillActiveGames(guild, channelId, platform, client) {
    const db = getDB();
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const currentUnix = Math.floor(Date.now() / 1000);
    const games = await db.all(
        `SELECT * FROM posted_games 
         WHERE (expires_at IS NULL OR expires_at > ?) 
         AND (platform = ? OR platform = 'both' OR ? = 'both')`,
        [currentUnix, platform, platform],
    );

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
            iconURL: client.user.displayAvatarURL(),
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

        const getGuildSettings = () =>
            db.all('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);

        const formatConfigStatus = (settings) => {
            const channelLine = selectedChannel
                ? `**Channel:** <#${selectedChannel}>`
                : '**Channel:** *not selected*';
            const platformLine = selectedPlatform
                ? `**Platform:** ${PLATFORM_LABELS[selectedPlatform] || selectedPlatform}`
                : '**Platform:** *not selected*';
            const limitLine = settings.length >= MAX_CONFIGS
                ? `\n\n⚠️ Maximum **${MAX_CONFIGS}** channels reached. Pick an existing platform below to edit it.`
                : `\n\n_Slots: ${settings.length}/${MAX_CONFIGS}_`;
            return `${channelLine}\n${platformLine}${limitLine}`;
        };

        const buildPlatformOptions = (settings) => {
            const configured = new Set(settings.map((s) => s.platform));
            const atLimit = settings.length >= MAX_CONFIGS;

            const defs = [
                { label: 'Both (Steam & Epic)', value: 'both', emoji: '🎮', description: 'All free game notifications' },
                { label: 'Steam Only', value: 'steam', emoji: '💨', description: 'Steam notifications only' },
                { label: 'Epic Games Only', value: 'epic', emoji: '🎁', description: 'Epic notifications only' },
            ];

            return defs.map((opt) => ({
                ...opt,
                default: selectedPlatform === opt.value,
                disabled: atLimit && !configured.has(opt.value),
            }));
        };

        const renderAddEditForm = async () => {
            const settings = await getGuildSettings();
            return {
                content: `### 🛠️ Add or Edit Platform Configuration\n${formatConfigStatus(settings)}\n\nSelect a channel and platform, then save.`,
                embeds: [],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ChannelSelectMenuBuilder()
                            .setCustomId('select_channel')
                            .setPlaceholder(
                                selectedChannel
                                    ? `Channel: #${interaction.guild.channels.cache.get(selectedChannel)?.name ?? 'selected'}`
                                    : '1. Choose a notification channel',
                            )
                            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
                    ),
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('select_platform')
                            .setPlaceholder(
                                selectedPlatform
                                    ? `Platform: ${PLATFORM_LABELS[selectedPlatform]}`
                                    : '2. Choose a platform',
                            )
                            .addOptions(buildPlatformOptions(settings)),
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
            };
        };

        const renderDashboard = async () => {
            const settings = await getGuildSettings();

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Notification Setup Dashboard')
                .setDescription(
                    `Configure up to **${MAX_CONFIGS}** notification channels (e.g. Steam + Epic, or one **Both** channel).`,
                )
                .setColor(0x3498db)
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'No-Cost Configuration', iconURL: interaction.client.user.displayAvatarURL() });

            if (settings.length === 0) {
                embed.addFields({ name: 'Channels', value: 'No notification channels configured yet.' });
            } else {
                const settingsList = settings
                    .map((s) => `• **${s.platform.toUpperCase()}**: <#${s.channel_id}>`)
                    .join('\n');
                embed.addFields({
                    name: `Channels (${settings.length}/${MAX_CONFIGS})`,
                    value: settingsList,
                });
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
                if (i.deferred || i.replied) {
                    return i.editReply({ content: 'You do not have permission to use this.', embeds: [], components: [] });
                }
                return i.reply({ content: 'You do not have permission to use this.', flags: [64] });
            }

            try {
                if (i.customId === 'setup_add') {
                    selectedChannel = null;
                    selectedPlatform = null;
                    await respondToComponent(i, await renderAddEditForm());
                }

                else if (i.customId === 'select_channel') {
                    selectedChannel = i.values[0];
                    await respondToComponent(i, await renderAddEditForm());
                }

                else if (i.customId === 'select_platform') {
                    selectedPlatform = i.values[0];
                    await loadExistingForPlatform(selectedPlatform);
                    await respondToComponent(i, await renderAddEditForm());
                }

                else if (i.customId === 'save_config') {
                    if (!selectedChannel || !selectedPlatform) {
                        await i.reply({
                            content: '⚠️ Please select **both** a channel and a platform before saving.',
                            flags: [64],
                        });
                        return;
                    }

                    const settings = await getGuildSettings();
                    const isEdit = settings.some((s) => s.platform === selectedPlatform);

                    if (!isEdit && settings.length >= MAX_CONFIGS) {
                        await i.reply({
                            content: `⚠️ Maximum **${MAX_CONFIGS}** notification channels per server. Edit an existing platform or remove one first.`,
                            flags: [64],
                        });
                        return;
                    }

                    await i.deferUpdate();

                    await db.run(
                        `INSERT INTO guild_settings (guild_id, channel_id, platform)
                         VALUES (?, ?, ?)
                         ON CONFLICT(guild_id, platform) DO UPDATE SET
                         channel_id = excluded.channel_id`,
                        [guildId, selectedChannel, selectedPlatform],
                    );

                    await redis.del(`guild:${guildId}`);
                    await redis.del(`channel:${guildId}:${selectedChannel}`);

                    const updatedDash = await renderDashboard();
                    await i.editReply({
                        content: `✅ **${PLATFORM_LABELS[selectedPlatform]}** → <#${selectedChannel}>`,
                        ...updatedDash,
                    });

                    backfillActiveGames(
                        interaction.guild,
                        selectedChannel,
                        selectedPlatform,
                        interaction.client,
                    ).catch((err) => console.error('[Setup] Backfill error:', err));
                }

                else if (i.customId === 'back_to_dash') {
                    const dash = await renderDashboard();
                    await respondToComponent(i, dash);
                }

                else if (i.customId === 'setup_remove_all') {
                    await i.deferUpdate();
                    await db.run('DELETE FROM guild_settings WHERE guild_id = ?', [guildId]);
                    await redis.del(`guild:${guildId}`);

                    const updatedDash = await renderDashboard();
                    await i.editReply({ content: '🗑️ All configurations have been removed.', ...updatedDash });
                }
            } catch (error) {
                console.error('[Setup] Interaction error:', error);
                try {
                    const payload = { content: '❌ Something went wrong. Run `/setup` again.', embeds: [], components: [] };
                    if (i.deferred || i.replied) {
                        await i.editReply(payload);
                    } else {
                        await i.reply({ ...payload, flags: [64] });
                    }
                } catch {
                    // Interaction expired
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
