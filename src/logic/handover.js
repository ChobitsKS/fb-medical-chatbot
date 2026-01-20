const cache = require('../utils/cache');

// Key prefix for handover status
const HANDOVER_PREFIX = 'handover_';

// Timeout in seconds (1 minute)
const HANDOVER_TIMEOUT = 60;

/**
 * Check if the user is in human mode
 * @param {string} userId - User PSID
 * @returns {boolean}
 */
const isHumanMode = (userId) => {
    const key = `${HANDOVER_PREFIX}${userId}`;
    const lastAdminInteraction = cache.get(key);

    if (!lastAdminInteraction) return false;

    const now = Date.now();
    // Check if timeout passed
    if (now - lastAdminInteraction > HANDOVER_TIMEOUT * 1000) {
        cache.del(key);
        return false;
    }

    return true;
};

/**
 * Activate human mode (called when Admin replies)
 * @param {string} userId 
 */
const setHumanMode = (userId) => {
    const key = `${HANDOVER_PREFIX}${userId}`;
    cache.set(key, Date.now(), HANDOVER_TIMEOUT);
    console.log(`[Handover] Human mode ACTIVATED for user ${userId}`);
};

/**
 * Refresh human mode (called when user talks during human mode)
 * Actually, the requirement says: "If admin disappears for 1 min, bot comes back".
 * It doesn't explicitly say user messages refresh the timer.
 * "If no new message from BOTH user and admin within 1 min -> Bot returns."
 * So yes, user message should also refresh the timer IF already in human mode.
 */
const refreshHumanMode = (userId) => {
    if (isHumanMode(userId)) {
        const key = `${HANDOVER_PREFIX}${userId}`;
        cache.set(key, Date.now(), HANDOVER_TIMEOUT);
    }
};

module.exports = {
    isHumanMode,
    setHumanMode,
    refreshHumanMode
};
