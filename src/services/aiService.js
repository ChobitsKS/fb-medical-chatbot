const Groq = require('groq-sdk');
const config = require('../config');

const groq = new Groq({ apiKey: config.groq.apiKey });

const CHAT_CATEGORIES_CONFIG = []; // Deprecated: No more classification
const CHAT_CATEGORIES = [];

// ฟังก์ชันจัดหมวดหมู่ (ไม่ได้ใช้แล้ว แต่เก็บไว้เผื่ออนาคต หรือลบออกก็ได้)
const classifyCategory = async (userMessage) => {
    return 'KnowledgeBase'; // บังคับคืนค่าชื่อ Sheet หลักเลย
};


/**
 * Generate answer based on context
 * @param {string} userMessage 
 * @param {Array} contextRows - Array of data objects
 * @returns {Promise<string>}
 */
const generateAnswer = async (userMessage, contextRows) => {
    try {
        // Prepare context string
        const contextText = contextRows.map(row =>
            `- คำถาม: ${row.question}\n  คำตอบ: ${row.answer}\n  หมายเหตุ: ${row.note || '-'}`
        ).join('\n\n');

        const systemPrompt = `คุณคือ "เจ้าหน้าที่ดูแลเพจของโรงเรียนแพทย์และวิทยาศาสตร์สุขภาพ"
หน้าที่ของคุณคือตอบคำถามผู้ใช้งานให้ถูกต้อง ชัดเจน สุภาพ และดูเป็นมิตร (ใช้สรรพนามแทนตัวเองว่า "เรา" หรือ "แอดมิน" และลงท้ายด้วย "ค่ะ")

ข้อมูลอ้างอิงสำหรับตอบคำถาม:
${contextText}

กฎเหล็กในการตอบ:
1. ตอบคำถามโดยใช้ข้อมูลจาก "ข้อมูลอ้างอิง" เท่านั้น
2. ห้ามเดาข้อมูลตัวเลขหรือข้อเท็จจริงใหม่ แต่ "อนุญาตให้เชื่อมโยงความสัมพันธ์" ได้ เช่น ถ้าลูกค้าถามหา "เบอร์" และในข้อมูลมี "เบอร์โทรศัพท์" ให้ถือว่าเป็นเรื่องเดียวกัน
3. ถ้าข้อมูลใน "ข้อมูลอ้างอิง" ไม่เพียงพอที่จะตอบคำถาม ให้ตอบด้วยข้อความนี้เป๊ะๆ: "ขออภัย ข้อมูลส่วนนี้ยังไม่พร้อม สามารถทิ้งข้อความไว้ได้เลยค่ะ"
4. ภาษาที่ใช้ต้องเป็นกันเอง สุภาพ อบอุ่น เหมือนพี่สาวแนะนำน้อง
5. ตอบให้กระชับ ได้ใจความ`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `คำถาม: ${userMessage}`
                }
            ],
            model: config.groq.model,
            temperature: 0.4,
            max_tokens: 300,
        });

        return completion.choices[0]?.message?.content?.trim();

    } catch (error) {
        console.error('Error in AI Generation:', error);
        return 'ขออภัย ระบบขัดข้องชั่วคราว ลองถามใหม่ในอีกสักครู่นะคะ';
    }
};

/**
 * Expand user query into multiple related keywords for better search
 * @param {string} userQuery
 * @returns {Promise<string>}
 */
const expandSearchQuery = async (userQuery) => {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a search query optimizer. Convert the user input into a list of 3-5 relevant Thai/English keywords separated by spaces. Example: "แมพ" -> "แผนที่ map location ที่ตั้ง"'
                },
                {
                    role: 'user',
                    content: userQuery
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 50,
        });

        const expanded = completion.choices[0]?.message?.content?.trim();
        console.log(`[AI Expansion] "${userQuery}" -> "${expanded}"`);
        return expanded || userQuery;

    } catch (error) {
        console.error('Error in Query Expansion:', error);
        return userQuery; // Fallback to original
    }
};

module.exports = {
    classifyCategory,
    generateAnswer,
    expandSearchQuery
};
