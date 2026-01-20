const Groq = require('groq-sdk');
const config = require('../config');

const groq = new Groq({ apiKey: config.groq.apiKey });

const CHAT_CATEGORIES_CONFIG = [
    { name: 'ข้อมูลทั่วไปและสถานที่', desc: 'ประวัติ, ที่ตั้ง, แผนที่, การเดินทาง, อาคารเรียน, เวลาทำการ' },
    { name: 'หลักสูตรและสาขาที่เปิดสอน', desc: 'รายชื่อสาขา, หน่วยกิต, รายวิชา, วุฒิการศึกษา, เรียนอะไรบ้าง' },
    { name: 'การรับสมัครและเกณฑ์การคัดเลือก', desc: 'คุณสมบัติ, เอกสาร, TCAS, รอบรับสมัคร, เกณฑ์คะแนน, จำนวนรับ' },
    { name: 'การเรียนและกิจกรรมนักศึกษา', desc: 'ตารางเรียน, ชุดนักศึกษา, หอพัก, กิจกรรมรับน้อง, ชีวิตในมหาลัย' },
    { name: 'ค่าเทอมและทุนการศึกษา', desc: 'ค่าธรรมเนียม, ทุนการศึกษา, กยศ., การผ่อนผันค่าเทอม' },
    { name: 'การติดต่อและช่องทางติดตาม', desc: 'เบอร์โทร, อีเมล, เว็บไซต์, เพจคณะ, ติดต่อสอบถาม' },
    { name: 'คำถามที่พบบ่อย', desc: 'คำถามอื่นๆ ทั่วไปที่ไม่เข้าพวกด้านบน' }
];

const CHAT_CATEGORIES = CHAT_CATEGORIES_CONFIG.map(c => c.name);

/**
 * จัดหมวดหมู่ข้อความของผู้ใช้ (Classification)
 * @param {string} userMessage 
 * @returns {Promise<string>} ชื่อหมวดหมู่
 */
const classifyCategory = async (userMessage) => {
    try {
        // สร้าง Context ให้ AI เข้าใจขอบเขตของแต่ละหมวด
        const categoriesContext = CHAT_CATEGORIES_CONFIG.map(c => `- "${c.name}": ครอบคลุมเรื่อง ${c.desc}`).join('\n');

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `คุณคือ AI ผู้ช่วยจำแนกเจตนาของคำถาม (Intent Classification) หน้าที่ของคุณคือวิเคราะห์คำถามและเลือก "ชื่อหมวดหมู่" ที่ถูกต้องที่สุดเพียง 1 ชื่อ

รายชื่อหมวดหมู่และคำอธิบาย:
${categoriesContext}

คำสั่ง:
1. วิเคราะห์คำถามอย่างละเอียด
2. เลือกหมวดหมู่ที่ตรงกับเนื้อหาที่สุด
3. ตอบกลับมาเฉพาะ "ชื่อหมวดหมู่" เท่านั้น ห้ามมีเครื่องหมายคำพูด ห้ามมีคำอธิบายเพิ่ม
4. ถ้าไม่แน่ใจ หรือคำถามกว้างมาก ให้เลือก "คำถามที่พบบ่อย"`
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            model: config.groq.model,
            temperature: 0.3,
            max_tokens: 50,
        });

        const category = completion.choices[0]?.message?.content?.trim();
        // Validate if result is in known list
        if (CHAT_CATEGORIES.includes(category)) {
            return category;
        }
        return 'คำถามที่พบบ่อย'; // Fallback

    } catch (error) {
        console.error('Error in AI Classification:', error);
        return 'คำถามที่พบบ่อย'; // Fallback on error
    }
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
