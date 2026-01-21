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
                active: isActive
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

    // 1. หาด้วย Keyword (แม่นยำสูงสุด)
    const keywordMatches = data.filter(row => {
        return containsKeyword(userQuery, row.keyword);
    });

    // 2. หาด้วย Text Overlap (คะแนนความเหมือน)
    const scoredRows = data.map(row => {
        let score = 0;
        const queryWords = userQuery.split(/\s+/);
        const questionWords = (row.question || '').split(/\s+/);

        queryWords.forEach(qWord => {
            if (questionWords.some(aWord => aWord.includes(qWord))) score++;
        });

        return { row, score };
    });

    // เรียงลำดับจากคะแนนมากไปน้อย
    scoredRows.sort((a, b) => b.score - a.score);
    const textMatches = scoredRows.map(item => item.row);

    // 3. รวมผลลัพธ์ (Keyword มาก่อน ตามด้วย Text Match)
    // ใช้ Set เพื่อตัดตัวซ้ำ
    const combinedResults = new Set([...keywordMatches, ...textMatches]);

    // แปลงกลับเป็น Array และตัดเอาแค่ 5 อันดับแรก
    return Array.from(combinedResults).slice(0, 5);
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

module.exports = {
    searchSheet,
    findKeywordMatch
};
