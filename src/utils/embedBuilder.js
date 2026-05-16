const { EmbedBuilder } = require('discord.js');

const COLORS = {
    epic: 0x9b59b6, // Purple
    steam: 0x3498db, // Blue
    both: 0x2ecc71  // Green
};

function buildGameEmbed({ title, description, platform, url, image_url, expiry, iconURL }) {
    const PLATFORM_ICONS = {
        epic: 'https://cdn2.iconfinder.com/data/icons/social-media-2285/512/1_Epic_Games_social_media_logo-512.png',
        steam: 'https://cdn-icons-png.flaticon.com/512/512/512392.png',
        both: iconURL
    };

    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    const platformIcon = PLATFORM_ICONS[platform.toLowerCase()] || PLATFORM_ICONS.both;

    let finalDescription = description || 'No description provided.';
    finalDescription += `\n\n**Platform:** ${platformName}`;
    if (expiry) {
        finalDescription += `\n**Expiry:** ${expiry}`;
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: platformName, iconURL: platformIcon })
        .setTitle(title)
        .setDescription(finalDescription)
        .setColor(COLORS[platform.toLowerCase()] || COLORS.both)
        .setTimestamp()
        .setFooter({ text: 'No-Cost', iconURL });

    if (url) {
        embed.setURL(url);
    }

    if (image_url) {
        embed.setImage(image_url);
    }

    return embed;
}

module.exports = { buildGameEmbed, COLORS };
