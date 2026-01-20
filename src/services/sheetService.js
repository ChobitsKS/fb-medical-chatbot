const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../config');
const cache = require('../utils/cache');
const { containsKeyword } = require('../utils/textUtil');

// Initialize auth - this is how google-spreadsheet v4 works
const serviceAccountAuth = new JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(config.google.sheetId, serviceAccountAuth);

/**
 * ดึงข้อมูลจาก Sheet ตามหมวดหมู่
 * @param {string} category - ชื่อหมวดหมู่ (ชื่อ Sheet)
 * @returns {Promise<Array>} - อาร์เรย์ของข้อมูล
 */
const getSheetData = async (category) => {
    const cacheKey = `sheet_${category}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`[Cache] พบข้อมูลใน Cache สำหรับหมวดหมู่: ${category}`);
        return cachedData;
    }

    console.log(`[API] กำลังดึงข้อมูลจาก Google Sheet: ${category}`);
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[category];

        if (!sheet) {
            console.error(`Sheet not found: ${category}`);
            return [];
        }

        const rows = await sheet.getRows();

        // Transform rows to plain objects
        const data = rows.map(row => ({
            keyword: row.get('keyword') ? row.get('keyword').split(',').map(k => k.trim()) : [],
            question: row.get('question'),
            answer: row.get('answer'),
            active: row.get('active')
        })).filter(item => item.active === 'TRUE' || item.active === 'true' || item.active === true); // Filter only active rows

        cache.set(cacheKey, data);
        return data;

    } catch (error) {
        console.error('Error fetching Google Sheets:', error);
        return [];
    }
};

/**
 * Search for relevant rows based on user query
 * @param {string} category - The sheet/category to search in
 * @param {string} userQuery - The user's input message
 * @returns {Promise<Array>} - Top 5 relevant rows
 */
const searchSheet = async (category, userQuery) => {
    const data = await getSheetData(category);

    // Simple logic: priority to keyword match, then just return the rows.
    // In a fuller version, we might use vector search or more complex scoring.
    // Here we strictly follow the Rule-based + AI-based workflow:
    // 1. If keyword matches, prioritize it.

    const relevantRows = data.filter(row => {
        // Check if any of the row's keywords appear in the user query
        return containsKeyword(userQuery, row.keyword);
    });

    if (relevantRows.length > 0) {
        // If keyword matches found, return them (up to 5)
        return relevantRows.slice(0, 5);
    }

    // If no strict keyword match, we might return top 5 general rows 
    // BUT the requirement says: "If not found: let Groq create answer".
    // AND "Pull Top-5 closest rows to reduce token usage".
    // Without semantic search embedding, "closest" is hard to determine purely by code.
    // We will return the first 5 rows as context if no keyword match found, 
    // assuming the Category Classification was accurate enough that this sheet contains relevant info.
    // OR we can implement a basic text overlap score.

    // Let's implement basic text overlap scoring
    const scoredRows = data.map(row => {
        let score = 0;
        const queryWords = userQuery.split(/\s+/);
        const questionWords = (row.question || '').split(/\s+/);

        queryWords.forEach(qWord => {
            if (questionWords.some(aWord => aWord.includes(qWord))) score++;
        });

        return { row, score };
    });

    // Sort by score descending
    scoredRows.sort((a, b) => b.score - a.score);

    // Return top 5
    return scoredRows.slice(0, 5).map(item => item.row);
};

module.exports = {
    searchSheet
};
