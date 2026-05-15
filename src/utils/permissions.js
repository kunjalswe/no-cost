const AUTHORIZED_USERS = ["1425018608232173619"];

function isAuthorized(userId) {
    return AUTHORIZED_USERS.includes(userId);
}

module.exports = { isAuthorized, AUTHORIZED_USERS };
