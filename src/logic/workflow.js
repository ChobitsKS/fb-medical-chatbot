const aiService = require('../services/aiService');
const sheetService = require('../services/sheetService');
const fbService = require('../services/fbService');
const handover = require('./handover');

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
        // แสดงสถานะกำลังพิมพ์ (Visual Feedback)
        await fbService.sendTyping(senderId);

        // 2. แยกหมวดหมู่ (Classify) - ไม่ใช้แล้ว ข้ามไปใช้ 'KnowledgeBase' เลย
        // const category = await aiService.classifyCategory(messageText);
        const category = 'KnowledgeBase'; // ชื่อ Sheet ใหม่ที่คุณต้องสร้าง
        console.log(`[Workflow] ใช้ชีตหลัก: ${category}`);

        // 3. Rule-Based First: ค้นหา Keyword เป๊ะๆ ก่อน
        const directMatches = await sheetService.findKeywordMatch(category, messageText);

        if (directMatches && directMatches.length > 0) {
            console.log(`[Workflow] พบ Keyword ตรงเป๊ะจำนวน ${directMatches.length} รายการ! ตอบทันที`);

            // รวมคำตอบจากทุก Keyword ที่เจอ
            const combinedAnswer = directMatches
                .map(match => match.answer)
                .join('\n----------------\n'); // แยกคำตอบด้วยเส้นขีด หรือเว้นบรรทัด

            await fbService.sendMessage(senderId, combinedAnswer);
            return; // จบการทำงานทันที
        }

        // 4. ถ้าไม่เจอ Keyword เป๊ะๆ -> ให้ AI ช่วยตอบ (AI-Based Fallback)
        console.log(`[Workflow] ไม่เจอ Keyword ตรงเป๊ะ -> ใช้ AI ช่วยตอบ`);
        const contextRows = await sheetService.searchSheet(category, messageText);
        console.log(`[Workflow] พบข้อมูลบริบทที่เกี่ยวข้อง: ${contextRows.length} แถว`);

        const answer = await aiService.generateAnswer(messageText, contextRows);

        // 5. ส่งคำตอบกลับ
        await fbService.sendMessage(senderId, answer);

    } catch (error) {
        console.error('[Workflow] เกิดข้อผิดพลาด:', error);
        await fbService.sendMessage(senderId, "ขออภัย ระบบขัดข้องเล็กน้อย ทิ้งข้อความไว้ได้เลยนะคะ เดี๋ยวแอดมินมาตอบค่ะ");
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
