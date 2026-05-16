const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

// Ordered list of migrations. Each runs exactly once, tracked by its index (version number).
const MIGRATIONS = [
    // v1 — base schema
    `CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        platform   TEXT DEFAULT 'both',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS posted_games (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        platform    TEXT NOT NULL,
        description TEXT,
        url         TEXT,
        image_url   TEXT,
        posted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at  INTEGER
    );`,

    // v2 — add expires_at column (safe to re-run via IF NOT EXISTS workaround is not needed;
    //       this migration only runs once thanks to the version table)
    `ALTER TABLE posted_games ADD COLUMN expires_at INTEGER;`,

    // v3 — support separate channels for separate platforms
    `CREATE TABLE IF NOT EXISTS guild_settings_v3 (
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        platform   TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, platform)
    );
    INSERT OR IGNORE INTO guild_settings_v3 (guild_id, channel_id, platform, created_at)
    SELECT guild_id, channel_id, platform, created_at FROM guild_settings;
    DROP TABLE guild_settings;
    ALTER TABLE guild_settings_v3 RENAME TO guild_settings;`,
];

async function runMigrations() {
    // Create version tracking table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );
    `);

    const row = await db.get('SELECT MAX(version) AS current FROM schema_version');
    const currentVersion = row?.current ?? -1;

    for (let i = currentVersion + 1; i < MIGRATIONS.length; i++) {
        console.log(`[DB] Running migration v${i}...`);
        await db.exec(MIGRATIONS[i]);
        await db.run('INSERT INTO schema_version (version) VALUES (?)', [i]);
        console.log(`[DB] Migration v${i} complete.`);
    }
}

async function initDB() {
    db = await open({
        filename: path.join(__dirname, '../../data.db'),
        driver: sqlite3.Database
    });

    await runMigrations();

    console.log('Database connected and schemas initialized.');
    return db;
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call initDB() first.');
    }
    return db;
}

module.exports = { initDB, getDB };

