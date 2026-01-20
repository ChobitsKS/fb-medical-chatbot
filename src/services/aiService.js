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
2. ห้ามเดา ห้ามสร้างข้อมูลใหม่ ห้ามสมมติเองเด็ดขาด
3. ถ้าข้อมูลใน "ข้อมูลอ้างอิง" ไม่เพียงพอที่จะตอบคำถาม หรือไม่ตรงกับคำถาม ให้ตอบด้วยข้อความนี้เป๊ะๆ ห้ามแก้ไข: "ขออภัย ข้อมูลส่วนนี้ยังไม่พร้อม สามารถทิ้งข้อความไว้ได้เลยค่ะ"
4. ภาษาที่ใช้ต้องเป็นกันเอง สุภาพ อบอุ่น เหมือนพี่สาวแนะนำน้อง ไม่ใช้ภาษาราชการจ๋าเกินไป
5. ตอบให้กระชับ ได้ใจความ
`;

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

module.exports = {
    classifyCategory,
    generateAnswer
};
