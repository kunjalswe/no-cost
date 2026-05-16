# No-Cost Bot

> A locally hosted Discord bot that tracks and broadcasts **free game deals** from Steam & Epic Games to multiple servers simultaneously. Built with **Discord.js v14** and **SQLite**.

[![Invite Bot](https://img.shields.io/badge/Invite-No--Cost%20Bot-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1504853562801524856&scope=bot&permissions=137439266880)
[![Support Server](https://img.shields.io/badge/Support-Discord%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/yarZZ5zeNP)

---

## ✨ Features

- 📢 **Multi-server broadcasting** — post one game, notify every configured server instantly
- 🎮 **Platform filtering** — Steam, Epic Games, or both per server
- ⏰ **Auto-expiry cleanup** — expired deals are pruned from the database automatically every minute
- 🕒 **Native Discord timestamps** — relative countdown timers on every embed
- 🔒 **Permission-gated commands** — separate tiers for public users, admins, and the developer

---

## 🔗 Links

| | Link |
|---|---|
| **Invite Bot** | https://discord.com/oauth2/authorize?client_id=1504853562801524856&scope=bot&permissions=137439266880 |
| **Support Server** | https://discord.gg/yarZZ5zeNP |

---

## 📋 Prerequisites

- **Node.js** v16.14 or higher
- A **Discord Bot Token** & **Client ID** from the [Discord Developer Portal](https://discord.com/developers/applications)

---

## 🚀 Local Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```
Open `.env` and fill in your `DISCORD_TOKEN` and `CLIENT_ID`.

3. **Start the bot:**
```bash
npm start
```

> The SQLite database (`data.db`) is generated automatically on first boot.

---

## 🖥️ Production Deployment

Use **PM2** to keep the bot running 24/7 on a VPS or server.

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start src/index.js --name "nocost-bot"

# Enable auto-restart on reboot
pm2 startup
pm2 save
```

### Useful PM2 Commands

| Command | Description |
|---|---|
| `pm2 logs nocost-bot` | View live console output |
| `pm2 stop nocost-bot` | Stop the bot |
| `pm2 restart nocost-bot` | Restart the bot |
| `pm2 status` | View all running processes |

---

## 📖 Commands

### Public

| Command | Description |
|---|---|
| `/free` | List currently active free games (filterable by platform) |
| `/ping` | Check bot API and WebSocket latency |
| `/status` | View uptime, server count, and database status |
| `/invite` | Get the bot invite link and support server link |
| `/help` | Dynamic help menu showing commands based on your permissions |

### Admin (Requires `Manage Guild` permission)

| Command | Description |
|---|---|
| `/setup set` | Configure the notification channel and platform filter for this server |
| `/setup remove` | Remove this server's notification configuration |

### Developer (Authorized User Only)

| Command | Description |
|---|---|
| `/addgame` | Broadcast a free game offer to all configured servers with a countdown and button |
| `/removegame` | Remove a game from the database via autocomplete dropdown |

---

## 🗂️ Project Structure

```
no-cost/
├── src/
│   ├── commands/         # Slash command files
│   ├── database/         # SQLite init & connection
│   ├── events/           # Discord.js event handlers
│   └── utils/            # Helpers (embeds, permissions, time parser)
├── data.db               # SQLite database (auto-generated)
├── .env                  # Environment variables (not committed)
└── package.json
```

