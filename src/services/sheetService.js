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

        // แปลงข้อมูลเป็น object
        const data = rows.map(row => {
            const activeVal = row.get('active');
            // Normalize active value to boolean (handle 'TRUE', 'True', 'true')
            const isActive = String(activeVal).toLowerCase().trim() === 'true';

            return {
                keyword: row.get('keyword') ? row.get('keyword').split(',').map(k => k.trim()) : [],
                question: row.get('question'),
                answer: row.get('answer'),
                note: row.get('note'),
                active: isActive,
                type: row.get('type') || 'text', // Default to text
                media: row.get('media') || ''
            };
        }).filter(item => item.active === true); // กรองเฉพาะแถวที่ active = true

        cache.set(cacheKey, data);
        return data;

    } catch (error) {
        console.error('Error fetching Google Sheets:', error);
        return [];
    }
};

/**
 * ค้นหาข้อมูลที่เกี่ยวข้องจากคำถามของผู้ใช้
 * @param {string} category - หมวดหมู่ที่จะค้นหา
 * @param {string} userQuery - ข้อความของผู้ใช้
 * @returns {Promise<Array>} - ข้อมูลที่ตรงที่สุด 5 อันดับแรก
 */
const searchSheet = async (category, userQuery) => {
    const data = await getSheetData(category);

    // Split expanded query into tokens (e.g. "แมพ แผนที่ map" -> ["แมพ", "แผนที่", "map"])
    const queryTokens = userQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    console.log(`[Search] Query Tokens:`, queryTokens);

    // 2. คำนวณคะแนนความเกี่ยวข้อง (Scoring)
    const scoredRows = data.map(row => {
        let score = 0;

        // Iterate through ALL tokens from the expanded query
        queryTokens.forEach(token => {
            // Check Keywords
            if (row.keyword && row.keyword.some(k => k && (k.toLowerCase().includes(token) || token.includes(k.toLowerCase())))) {
                score += 50; // Strong match on keyword
            }

            // Check Content (Question/Answer) using calculateRelevance
            const { calculateRelevance } = require('../utils/textUtil');
            score += calculateRelevance(row.question, token);
            score += calculateRelevance(row.answer, token);
        });

        return { row, score };
    });

    // กรองเอาเฉพาะที่มีคะแนน > 0
    const relevantRows = scoredRows
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score) // เรียงคะแนนมาก -> น้อย
        .map(item => item.row);

    console.log(`[Search] Found ${relevantRows.length} relevant rows for query: "${userQuery}"`);

    // ตัดมาแค่ 5 อันดับแรก และไม่เอาตัวซ้ำ (Unique)
    const uniqueRows = [...new Set(relevantRows)];
    return uniqueRows.slice(0, 5);
};

/**
 * ค้นหาข้อมูลที่ตรงกับ Keyword เป๊ะๆ
 * @param {string} category - หมวดหมู่ที่จะค้นหา
 * @param {string} userQuery - ข้อความของผู้ใช้
 * @returns {Promise<Array>} - อาร์เรย์ของแถวข้อมูลที่ตรง
 */
const findKeywordMatch = async (category, userQuery) => {
    const data = await getSheetData(category);
    // Find ALL rows where keyword exists in userQuery
    return data.filter(row => containsKeyword(userQuery, row.keyword));
};

/**
 * บันทึกคำถามที่ตอบไม่ได้ลงใน Sheet "Unanswered"
 * @param {string} userQuery 
 */
const logUnanswered = async (userQuery) => {
    try {
        await doc.loadInfo();
        let sheet = doc.sheetsByTitle['Unanswered'];

        // ถ้ายังไม่มี Sheet นี้ ให้สร้างใหม่เลย (Optional)
        if (!sheet) {
            console.log('[Sheet] Creating new sheet: Unanswered');
            // Try to create it (might fail if permissions are restricted)
            try {
                sheet = await doc.addSheet({ title: 'Unanswered', headerValues: ['timestamp', 'query'] });
            } catch (createErr) {
                console.error('Cannot create sheet Unanswered. Permission denied?');
                return false;
            }
        } else {
            // Check if headers exist
            try {
                await sheet.loadHeaderRow();
                if (!sheet.headerValues || sheet.headerValues.length === 0) {
                    console.log('[Sheet] Headers likely missing. Setting default headers.');
                    await sheet.setHeaderRow(['timestamp', 'question']);
                }
            } catch (headerErr) {
                // Ignore header errors on empty sheet
            }
        }

        // Use Array-based insertion
        await sheet.addRow([new Date().toLocaleString('th-TH'), userQuery]);

        console.log(`[Sheet] Logged unanswered query: "${userQuery}"`);
        return true;

    } catch (error) {
        console.error('[Sheet] Error logging unanswered query:', error);
        return false;
    }
};

module.exports = {
    searchSheet,
    findKeywordMatch,
    logUnanswered
};
