const { EmbedBuilder } = require('discord.js');

const COLORS = {
    epic: 0x9b59b6, // Purple
    steam: 0x3498db, // Blue
    both: 0x2ecc71  // Green
};

function buildGameEmbed({ title, description, platform, url, image_url, expiry, iconURL }) {
    const PLATFORM_ICONS = {
        epic: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png',
        steam: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png',
        both: iconURL
    };

    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    const platformIcon = PLATFORM_ICONS[platform.toLowerCase()] || PLATFORM_ICONS.both;

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${platformName} Free Game`, iconURL: platformIcon })
        .setTitle(`🎁 ${title}`)
        .setColor(COLORS[platform.toLowerCase()] || COLORS.both)
        .setTimestamp()
        .setFooter({ text: 'No-Cost Notification System', iconURL });

    let finalDescription = '';
    if (description) {
        finalDescription += `${description}\n\n`;
    }

    if (expiry) {
        finalDescription += `⌛ **Expires:** ${expiry}\n`;
    }
    
    if (url) {
        finalDescription += `🔗 **Claim here:** [Click to open](${url})`;
        embed.setURL(url);
    }

    if (finalDescription) {
        embed.setDescription(finalDescription);
    }

    if (image_url && image_url.startsWith('http')) {
        embed.setImage(image_url);
    }

    return embed;
}

module.exports = { buildGameEmbed, COLORS };
