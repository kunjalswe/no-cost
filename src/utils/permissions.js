// Comma-separated user IDs in .env → AUTHORIZED_USER_IDS=id1,id2
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

function isAuthorized(userId) {
    return AUTHORIZED_USERS.includes(userId);
}

module.exports = { isAuthorized, AUTHORIZED_USERS };

