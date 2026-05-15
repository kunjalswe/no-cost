# No-Cost Bot

A locally hosted Discord bot designed to track and broadcast free game deals (Steam & Epic Games) to multiple servers. Built with Discord.js v14 and SQLite.

## Prerequisites
- Node.js (v16.14 or higher)
- Discord Bot Token & Client ID (From the [Discord Developer Portal](https://discord.com/developers/applications))

## Local Installation

1. Install all required dependencies:
```bash
npm install
```

2. Copy the `.env.example` file to `.env` and fill in your credentials:
```bash
cp .env.example .env
```
*(Open `.env` and paste your `DISCORD_TOKEN` and `CLIENT_ID`)*

3. Start the bot!
```bash
npm start
```
*Note: The SQLite database (`data.db`) will be automatically generated upon the first successful boot.*

## Production Deployment

It is highly recommended to use a process manager like **PM2** to keep the bot running 24/7 in the background on your VPS or host.

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Start the bot with PM2:
```bash
pm2 start src/index.js --name "nocost-bot"
```

3. Enable PM2 to start on server reboot:
```bash
pm2 startup
pm2 save
```

### PM2 Helpful Commands:
- View live console logs: `pm2 logs nocost-bot`
- Stop the bot: `pm2 stop nocost-bot`
- Restart the bot: `pm2 restart nocost-bot`

## Core Commands

| Command | Permission | Description |
|---|---|---|
| `/setup` | Administrator | Configure the channel and preferred platform (Steam/Epic/Both) for notifications. |
| `/addgame` | Developer ID Only | Broadcast a free game offer to all configured servers. Includes interactive 'Get Game' buttons and Discord countdown timestamps. |
| `/free` | Public | List active non-expired free games. Filterable by platform. |
| `/status` | Public | View bot uptime, ping, database connection status, and server count. |
| `/ping` | Public | View current API and Websocket latency. |
| `/help` | Public | Dynamic help menu displaying accessible commands. |
