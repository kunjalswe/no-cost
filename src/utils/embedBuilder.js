const { EmbedBuilder } = require('discord.js');

const COLORS = {
    epic: 0x9b59b6, // Purple
    steam: 0x3498db, // Blue
    both: 0x2ecc71  // Green
};

function buildGameEmbed({ title, description, platform, url, image_url, expiry }) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description || 'No description provided.')
        .setColor(COLORS[platform.toLowerCase()] || COLORS.both)
        .setTimestamp()
        .setFooter({ text: 'No-Cost' });

    embed.addFields({ name: 'Platform', value: platform.charAt(0).toUpperCase() + platform.slice(1), inline: true });

    if (expiry) {
        embed.addFields({ name: 'Expiry', value: expiry, inline: true });
    }

    if (url) {
        embed.setURL(url);
    }

    if (image_url) {
        embed.setThumbnail(image_url);
    }

    return embed;
}

module.exports = { buildGameEmbed, COLORS };
