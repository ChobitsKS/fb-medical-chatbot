/**
 * Normalize text for better matching:
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove special characters (optional, depending on strictness)
 */
const normalizeText = (text) => {
    if (!text) return '';
    return text.toString().trim().toLowerCase();
};

/**
 * Check if a text contains any of the keywords
 * @param {string} text - User input
 * @param {string[]} keywords - List of keywords from sheet
 */
/**
 * Check if a text contains any of the keywords
 * @param {string} text - User input
 * @param {string[]} keywords - List of keywords from sheet
 */
const containsKeyword = (text, keywords) => {
    const normalizedText = normalizeText(text);
    return keywords.some(keyword => {
        const normalizedKey = normalizeText(keyword);
        return normalizedKey && normalizedText.includes(normalizedKey);
    });
};

/**
 * Calculate simple relevance score for Thai text (no spaces)
 * @param {string} text - Text to check (Question/Answer)
 * @param {string} query - User query
 */
const calculateRelevance = (text, query) => {
    const nText = normalizeText(text);
    const nQuery = normalizeText(query);
    if (!nText || !nQuery) return 0;

    let score = 0;

    // 1. Direct substring match (Query is inside Text)
    if (nText.includes(nQuery)) score += 10;

    // 2. Reverse substring match (Text is inside Query - rare but possible for short text)
    if (nQuery.includes(nText)) score += 10;

    // 3. Keyword/Jaccard-like overlap (useful if query has spaces)
    // If query was "หอใน ดีไหม", split -> "หอใน", "ดีไหม"
    const queryParts = nQuery.split(' ').filter(p => p.length > 1);
    if (queryParts.length > 1) {
        queryParts.forEach(part => {
            if (nText.includes(part)) score += 2;
        });
    }

    return score;
};

module.exports = {
    normalizeText,
    containsKeyword,
    calculateRelevance
};
