function settingMatchesGame(settingPlatform, gamePlatform) {
    if (gamePlatform === 'both' || settingPlatform === 'both') {
        return true;
    }
    return settingPlatform === gamePlatform;
}

module.exports = { settingMatchesGame };
