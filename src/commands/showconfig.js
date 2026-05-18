const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('../database');
const { isAuthorized } = require('../utils/permissions');

const SERVERS_PER_PAGE = 2;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showconfig')
        .setDescription('[DEV] Show server configurations')
        .addStringOption(option =>
            option
                .setName('server_id')
                .setDescription('Optional: Specific server ID to show config for')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Dev only check
        if (!isAuthorized(interaction)) {
            return interaction.reply({
                content: '❌ This is a developer-only command.',
                flags: [64],
            });
        }

        const db = getDB();
        const serverId = interaction.options.getString('server_id');

        // If specific server ID provided
        if (serverId) {
            const settings = await db.all(
                'SELECT * FROM guild_settings WHERE guild_id = ?',
                [serverId]
            );

            if (settings.length === 0) {
                return interaction.reply({
                    content: `❌ No configuration found for server \`${serverId}\`.`,
                    flags: [64],
                });
            }

            const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
            const guildName = guild?.name ?? 'Unknown Server';
            const guildIcon = guild?.iconURL() ?? null;

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Configuration for ${guildName}`)
                .setDescription(`Server ID: \`${serverId}\``)
                .setColor(0x3498db)
                .setThumbnail(guildIcon);

            for (const setting of settings) {
                const channel = await interaction.guild.client.channels.fetch(setting.channel_id).catch(() => null);
                const channelName = channel?.name ?? 'Unknown Channel';
                const platformLabel = setting.platform.toUpperCase();
                const pingRoleText = setting.ping_role_id
                    ? `<@&${setting.ping_role_id}>`
                    : 'None';

                embed.addFields({
                    name: `📺 ${platformLabel}`,
                    value: `**Channel:** <#${setting.channel_id}> (\`${channelName}\`)\n**Ping Role:** ${pingRoleText}\n**Created:** <t:${Math.floor(new Date(setting.created_at).getTime() / 1000)}:F>`,
                    inline: false,
                });
            }

            return interaction.reply({ embeds: [embed] });
        }

        // Show all servers with pagination
        const allGuilds = Array.from(interaction.client.guilds.cache.values());

        if (allGuilds.length === 0) {
            return interaction.reply({
                content: '❌ Bot is not in any servers.',
                flags: [64],
            });
        }

        // Fetch configs for all guilds
        const guildConfigs = await Promise.all(
            allGuilds.map(async (guild) => {
                const settings = await db.all(
                    'SELECT * FROM guild_settings WHERE guild_id = ?',
                    [guild.id]
                );
                return { guild, settings };
            })
        );

        // Filter guilds with configs
        const configuredGuilds = guildConfigs.filter(gc => gc.settings.length > 0);

        if (configuredGuilds.length === 0) {
            return interaction.reply({
                content: '❌ No servers have configurations.',
                flags: [64],
            });
        }

        // Paginate: 2 servers per page
        const pages = [];
        for (let i = 0; i < configuredGuilds.length; i += SERVERS_PER_PAGE) {
            pages.push(configuredGuilds.slice(i, i + SERVERS_PER_PAGE));
        }

        let currentPage = 0;

        const buildEmbed = async (pageIndex) => {
            const page = pages[pageIndex];
            const embed = new EmbedBuilder()
                .setTitle('📋 Server Configurations')
                .setColor(0x3498db)
                .setFooter({
                    text: `Page ${pageIndex + 1} of ${pages.length}`,
                    iconURL: interaction.client.user.displayAvatarURL(),
                });

            for (const { guild, settings } of page) {
                let configText = '';
                for (const setting of settings) {
                    const channel = await interaction.guild.client.channels.fetch(setting.channel_id).catch(() => null);
                    const channelName = channel?.name ?? 'Unknown';
                    const pingRoleText = setting.ping_role_id ? `<@&${setting.ping_role_id}>` : 'None';
                    configText += `• **${setting.platform.toUpperCase()}**: <#${setting.channel_id}> (${channelName})\n  └─ Ping: ${pingRoleText}\n`;
                }

                embed.addFields({
                    name: `🏢 ${guild.name}`,
                    value: configText || '*No settings*',
                    inline: false,
                });
            }

            return embed;
        };

        const buildButtons = (pageIndex) => {
            const row = new ActionRowBuilder();

            if (pageIndex > 0) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`${pageIndex + 1} / ${pages.length}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            if (pageIndex < pages.length - 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            return row;
        };

        const initialEmbed = await buildEmbed(0);
        const initialButtons = buildButtons(0);

        const message = await interaction.reply({
            embeds: [initialEmbed],
            components: [initialButtons],
            flags: [64],
        });

        const collector = message.createMessageComponentCollector({
            time: 300000, // 5 minutes
        });

        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.user.id !== interaction.user.id) {
                return buttonInteraction.reply({
                    content: '❌ You cannot interact with this button.',
                    flags: [64],
                });
            }

            if (buttonInteraction.customId === 'next_page') {
                currentPage = Math.min(currentPage + 1, pages.length - 1);
            } else if (buttonInteraction.customId === 'prev_page') {
                currentPage = Math.max(currentPage - 1, 0);
            }

            const embed = await buildEmbed(currentPage);
            const buttons = buildButtons(currentPage);

            await buttonInteraction.update({
                embeds: [embed],
                components: [buttons],
            });
        });

        collector.on('end', async () => {
            try {
                await message.edit({ components: [] });
            } catch {
                // Ignore if message was deleted
            }
        });
    },
};
