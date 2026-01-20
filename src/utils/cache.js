const NodeCache = require('node-cache');
const config = require('../config');

// Standard TTL is 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: config.cacheTTL });

module.exports = {
    get: (key) => cache.get(key),
    set: (key, value, ttl = config.cacheTTL) => cache.set(key, value, ttl),
    del: (key) => cache.del(key),
    flush: () => cache.flushAll(),
};
