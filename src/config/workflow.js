/**
 * Message Processing Workflow (Rule-based + AI fallback)
 *
 * Flow:
 * 1. ตรวจสอบ Human Handover (Admin mode)
 * 2. Rule-based exact keyword matching from Google Sheets
 * 3. ส่งข้อความ / รูป / เมนู / carousel ตาม type
 * 4. หากไม่พบ keyword → AI-assisted search expansion
 * 5. Fallback เมื่อไม่พบข้อมูล
 *
 * Design Goals:
 * - ตอบเร็วด้วย Rule-based ก่อน (ประหยัด token)
 * - ใช้ AI เฉพาะเมื่อจำเป็น
 * - ป้องกัน bot เงียบหรือไม่ตอบผู้ใช้
 */
const aiService = require('../services/aiService');
const sheetService = require('../services/sheetService');
const fbService = require('../services/fbService');
const handover = require('./handover');

/**
 * Helper to clean CSV-style escaped JSON string from Google Sheets
 * e.g. "[{""type"":""...""}]" -> [{"type":"..."}]
 */
const cleanJsonString = (str) => {
    if (typeof str !== 'string') return str;
    let cleaned = str.trim();
    // Use regex to detect if it starts/ends with quotes and contains double quotes
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1); // Remove wrapping quotes
    }
    // Replace double double-quotes with single double-quote (CSV escaping)
    cleaned = cleaned.replace(/""/g, '"');
    return cleaned;
};

/**
 * ประมวลผลข้อความที่เข้ามา (Main Workflow)
 * @param {string} senderId - PSID ของผู้ใช้
 * @param {string} messageText - ข้อความที่ส่งมา
 */
const processMessage = async (senderId, messageText) => {
    // 1. ตรวจสอบสถานะ Handover (โหมดคนตอบ)
    if (handover.isHumanMode(senderId)) {
        console.log(`[Workflow] User ${senderId} อยู่ในโหมด Human บอทจะไม่ตอบกลับ`);
        handover.refreshHumanMode(senderId); // เลื่อนเวลาหมดอายุ
        return;
    }

    try {
        console.log(`[Workflow] Processing message: "${messageText}" from ${senderId}`);
        // แสดงสถานะกำลังพิมพ์ (Visual Feedback)
        await fbService.sendTyping(senderId);

        // 2. ใช้หมวดหมู่ 'KnowledgeBase'
        const category = 'KnowledgeBase';
        // console.log(`[Workflow] ใช้ชีตหลัก: ${category}`);

        // 3. Rule-Based First: ค้นหา Keyword เป๊ะๆ ก่อน
        const directMatches = await sheetService.findKeywordMatch(category, messageText);

        if (directMatches && directMatches.length > 0) {
            console.log(`[Workflow] พบ Keyword ตรงเป๊ะจำนวน ${directMatches.length} รายการ! ตอบทันที`);
            let contentSent = false;

            for (const match of directMatches) {
                // DEBUG LOGGING
                console.log(`[Workflow Debug] Processing Match: Type="${match.type}", Answer="${match.answer}"`);

                // 1. ส่งข้อความก่อน
                if (match.answer && match.answer.trim() !== '-' && match.type !== 'menu') {
                    await fbService.sendMessage(senderId, match.answer);
                    contentSent = true;
                }

                // 2. ถ้าเป็นรูปภาพ (Image)
                if (match.type === 'image' && match.media) {
                    console.log(`[Workflow] ส่งรูปภาพ: ${match.media}`);
                    await fbService.sendImage(senderId, match.media);
                    contentSent = true;
                }

                // 3. ถ้าเป็นเมนูธรรมดา (Button Template)
                if (match.type === 'menu' && match.media) {
                    try {
                        let buttons = match.media;
                        if (typeof buttons === 'string') {
                            const cleaned = cleanJsonString(buttons);
                            buttons = JSON.parse(cleaned);
                        }
                        console.log(`[Workflow] ส่งเมนูธรรมดา (Button)`);
                        const menuText = match.answer && match.answer.trim() !== '-' ? match.answer : 'กรุณาเลือกหัวข้อ';
                        await fbService.sendButtonTemplate(senderId, menuText, buttons);
                        contentSent = true;
                    } catch (e) {
                        console.error('[Workflow] Error parsing Menu JSON:', e);
                        await fbService.sendMessage(senderId, "(ขออภัย รูปแบบเมนูไม่ถูกต้อง - กรุณาติดต่อเจ้าหน้าที่)");
                        contentSent = true; // Error msg IS content
                    }
                }

                // 4. ถ้าเป็นเมนูแบบเลื่อน (Carousel)
                if (match.type === 'carousel' && match.media) {
                    try {
                        let elements = match.media;
                        if (typeof elements === 'string') {
                            const cleaned = cleanJsonString(elements);
                            elements = JSON.parse(cleaned);
                        }
                        console.log(`[Workflow] ส่ง Carousel`);
                        await fbService.sendGenericTemplate(senderId, elements);
                        contentSent = true;
                    } catch (e) {
                        console.error('[Workflow] Error parsing Carousel JSON:', e);
                        await fbService.sendMessage(senderId, "(ขออภัย รูปแบบ Carousel ไม่ถูกต้อง - กรุณาติดต่อเจ้าหน้าที่)");
                        contentSent = true;
                    }
                }
            }

            if (!contentSent) {
                console.warn('[Workflow] Match found but NO content sent (empty answer/media?). Sending fallback.');
                await fbService.sendMessage(senderId, "ขออภัยค่ะ ไม่มีข้อมูลในส่วนนี้ ฝากข้อความไว้ได้เลยค่ะ (ref.a02)");
            }
            return; // จบการทำงานทันที
        }

        // 4. ถ้าไม่เจอ Keyword เป๊ะๆ -> ให้ AI ช่วยตอบ (AI-Based Fallback)
        console.log(`[Workflow] ไม่เจอ Keyword ตรงเป๊ะ -> ใช้ AI ช่วยตอบ`);

        // 4.1 ให้ AI ช่วย "ขยายความ" คำค้นหา (AI Query Expansion) 🧠
        // เช่น "แมพ" -> "แผนที่ map location" เพื่อให้หาเจอใน Sheet (1 Credit)
        const expandedQuery = await aiService.expandSearchQuery(messageText);

        // 4.2 ค้นหาด้วยคำที่ขยายแล้ว (ระบบค้นหาจะแยกคำให้อัตโนมัติ)
        const contextRows = await sheetService.searchSheet(category, expandedQuery);
        console.log(`[Workflow] พบข้อมูลบริบทที่เกี่ยวข้อง: ${contextRows.length} แถว`);

        // 4.3 ตอบกลับทันที (ไม่ใช้ AI เรียบเรียงใหม่แล้ว เพื่อประหยัด Token)
        if (contextRows.length > 0) {
            // เอาอันที่คะแนนสูงสุด (ตัวแรก) มาตอบเลย
            const bestMatch = contextRows[0];
            console.log(`[Workflow] ตอบด้วยข้อมูลจาก Sheet ทันที: "${bestMatch.answer}"`);
            await fbService.sendMessage(senderId, bestMatch.answer);

            // ถ้ามีรูป/Media ติดมาด้วย ก็ส่งตามไปครับ
            if (bestMatch.type === 'image' && bestMatch.media) {
                await fbService.sendImage(senderId, bestMatch.media);
            }
        } else {
            console.log(`[Workflow] ไม่พบข้อมูลแม้จะขยายคำแล้ว -> บันทึก Unanswered Log`);
            await fbService.sendMessage(senderId, "ขออภัยค่ะ ไม่มีข้อมูลในส่วนนี้ ลองถามใหม่อีกสักครู่ค่ะ");

            // Log ลง Sheet เพื่อให้เจ้าหน้าที่มาตรวจสอบภายหลัง
            await sheetService.logUnanswered(messageText);
        }

    } catch (error) {
        console.error('[Workflow] เกิดข้อผิดพลาด:', error);
        await fbService.sendMessage(senderId, "ขออภัยค่ะ มีผู้ใช้งานเป็นจำนวนมาก ลองถามใหม่อีกสักครู่ค่ะ");
    }
};

/**
 * Handle Admin Reply (Echo event management would go here if we had access to read_mailbox permissions)
 * NOTE: Detecting "Admin Reply" via Webhooks requires specific subscription.
 * Usually, 'message_echoes' event tells us the Page sent a message.
 */
const handlePageEcho = (recipientId) => {
    // Recipient of an echo is the User.
    // Sender of an echo is the Page (Admin).
    // So if we see an echo to a user, it means Admin replied.
    if (recipientId) {
        handover.setHumanMode(recipientId);
    }
};

module.exports = {
    processMessage,
    handlePageEcho
};
