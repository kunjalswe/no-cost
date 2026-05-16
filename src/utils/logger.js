const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../audit.log');
const AUDIT_CHANNEL_ID = process.env.AUDIT_CHANNEL_ID;

/**
 * Logs an action to the audit file and optionally to a Discord channel.
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string} content - The content to log.
 */
async function logAudit(client, content) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${content}\n`;

    // 1. Log to file
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write to audit log file:', error);
    }

    // 2. Log to Discord channel
    if (client && AUDIT_CHANNEL_ID) {
        try {
            const channel = client.channels.cache.get(AUDIT_CHANNEL_ID) || await client.channels.fetch(AUDIT_CHANNEL_ID);
            if (channel && channel.isTextBased()) {
                await channel.send({
                    content: `🛡️ **Audit Log** [${new Date().toLocaleString()}]\n> ${content}`
                });
            }
        } catch (error) {
            console.error('Failed to send audit log to Discord:', error);
        }
    }
}

module.exports = { logAudit };
