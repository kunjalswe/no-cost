// Comma-separated IDs in .env
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

const AUTHORIZED_ROLES = (process.env.AUTHORIZED_ROLE_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

/**
 * Checks if a user is authorized based on ID or roles.
 * @param {import('discord.js').Interaction} interaction 
 */
function isAuthorized(interaction) {
    const userId = interaction.user.id;

    // 1. Check User IDs
    if (AUTHORIZED_USERS.includes(userId)) return true;

    // 2. Check Role IDs/Names
    if (interaction.member && interaction.member.roles) {
        return interaction.member.roles.cache.some(role => 
            AUTHORIZED_ROLES.includes(role.id) || AUTHORIZED_ROLES.includes(role.name)
        );
    }

    return false;
}

module.exports = { isAuthorized, AUTHORIZED_USERS, AUTHORIZED_ROLES };

