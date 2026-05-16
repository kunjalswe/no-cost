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
 * @param {import('discord.js').Interaction | string} interactionOrId 
 */
function isAuthorized(interactionOrId) {
    // Handle both interaction object and raw user ID string
    const isString = typeof interactionOrId === 'string';
    const userId = isString ? interactionOrId : interactionOrId.user.id;
    const member = isString ? null : interactionOrId.member;

    // 1. Check User IDs
    if (AUTHORIZED_USERS.includes(userId)) return true;

    // 2. Check Role IDs/Names
    if (member && member.roles) {
        return member.roles.cache.some(role => 
            AUTHORIZED_ROLES.includes(role.id) || AUTHORIZED_ROLES.includes(role.name)
        );
    }

    return false;
}

module.exports = { isAuthorized, AUTHORIZED_USERS, AUTHORIZED_ROLES };

