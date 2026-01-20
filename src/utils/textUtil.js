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
const containsKeyword = (text, keywords) => {
    const normalizedText = normalizeText(text);
    return keywords.some(keyword => normalizedText.includes(normalizeText(keyword)));
};

module.exports = {
    normalizeText,
    containsKeyword
};
