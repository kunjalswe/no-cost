async function getPingRoleId(db, guildId) {
    const row = await db.get(
        'SELECT ping_role_id FROM guild_ping_roles WHERE guild_id = ?',
        [guildId],
    );
    return row?.ping_role_id ?? null;
}

function formatPingContent(pingRoleId) {
    return pingRoleId ? `<@&${pingRoleId}>` : undefined;
}

function pingAllowedMentions(pingRoleId) {
    return pingRoleId ? { roles: [pingRoleId] } : undefined;
}

module.exports = { getPingRoleId, formatPingContent, pingAllowedMentions };
