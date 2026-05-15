/**
 * Parses a string like "1d 1h 1m 1s" and returns the total seconds.
 * Supports combinations of d (days), h (hours), m (minutes), s (seconds).
 * Example: "2d 12h" -> 216000
 */
function parseDurationToSeconds(durationStr) {
    if (!durationStr) return 0;

    let totalSeconds = 0;
    const regex = /(\d+)\s*(d|h|m|s)/gi;
    let match;

    while ((match = regex.exec(durationStr)) !== null) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'd':
                totalSeconds += value * 86400;
                break;
            case 'h':
                totalSeconds += value * 3600;
                break;
            case 'm':
                totalSeconds += value * 60;
                break;
            case 's':
                totalSeconds += value;
                break;
        }
    }

    return totalSeconds;
}

/**
 * Returns a UNIX timestamp (in seconds) representing the future time.
 */
function getFutureUnixTimestamp(durationStr) {
    const offsetSeconds = parseDurationToSeconds(durationStr);
    if (offsetSeconds === 0) return null;

    return Math.floor(Date.now() / 1000) + offsetSeconds;
}

module.exports = { parseDurationToSeconds, getFutureUnixTimestamp };
