const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
    db = await open({
        filename: path.join(__dirname, '../../data.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            platform TEXT DEFAULT 'both',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS posted_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            platform TEXT NOT NULL,
            description TEXT,
            url TEXT,
            image_url TEXT,
            posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at INTEGER
        );
    `);

    try {
        await db.exec(`ALTER TABLE posted_games ADD COLUMN expires_at INTEGER;`);
    } catch (e) {
        // Ignore if column already exists
    }

    console.log('Database connected and schemas initialized.');
    return db;
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}

module.exports = { initDB, getDB };
