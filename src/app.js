console.log('Starting application...'); // Debug Log
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const workflow = require('./logic/workflow');

const app = express();
app.use(bodyParser.json());

// Verification Endpoint for Facebook
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.fb.verifyToken) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400); // Bad Request if no params
    }
});

// Webhook Handler
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            const webhook_event = entry.messaging ? entry.messaging[0] : null;

            if (webhook_event) {
                // Handle standard messages
                if (webhook_event.message && !webhook_event.message.is_echo) {
                    const senderId = webhook_event.sender.id;
                    const messageText = webhook_event.message.text;

                    if (messageText) {
                        workflow.processMessage(senderId, messageText);
                    }
                }

                // Handle Postbacks (Menu/Button clicks)
                if (webhook_event.postback) {
                    const senderId = webhook_event.sender.id;
                    const payload = webhook_event.postback.payload;

                    console.log(`[Postback] Received payload: ${payload}`);
                    // Treat payload as a user message to trigger search
                    if (payload) {
                        workflow.processMessage(senderId, payload);
                    }
                }

                // Handle Echo (Admin replied)
                // ตรวจสอบว่าเป็นคนตอบจริงๆ หรือไม่ (ถ้าเป็น Bot ตอบ เราจะใส่ metadata="bot_reply" ไว้)
                if (webhook_event.message && webhook_event.message.is_echo) {
                    const metadata = webhook_event.message.metadata;
                    const recipientId = webhook_event.recipient.id;

                    // ถ้า metadata ไม่ใช่ "bot_reply" แปลว่าคนอื่นตอบ (แอดมิน)
                    if (metadata !== "bot_reply") {
                        console.log(`[Handover] Admin reply detected for user ${recipientId}`);
                        workflow.handlePageEcho(recipientId);
                    }
                }
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Health check
app.get('/', (req, res) => {
    res.send('Facebook Medical Chatbot is running.');
});

// Setup Profile Endpoint (Easier method for User)
app.get('/setup-profile', async (req, res) => {
    try {
        const axios = require('axios');
        const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

        const body = {
            get_started: { payload: "GET_STARTED" },
            greeting: [{ locale: "default", text: "ยินดีต้อนรับสู่แชทบอทโรงเรียนแพทย์ฯ 🏥\nกดปุ่ม 'เริ่มใช้งาน' เพื่อพูดคุยกับเราได้เลยค่ะ" }],
            ice_breakers: [{
                call_to_actions: [
                    { question: "หลักสูตร", payload: "หลักสูตร" },
                    { question: "ค่าเทอม", payload: "ค่าเทอม" },
                    { question: "ติดต่อเรา", payload: "ติดต่อ" },
                    { question: "เมนูหลัก", payload: "เมนู" }
                ],
                locale: "default"
            }]
        };

        await axios.post(
            `${FACEBOOK_API_URL}/me/messenger_profile?access_token=${config.fb.pageAccessToken}`,
            body
        );

        res.send('✅ ตั้งค่า Profile สำเร็จ! (ปุ่มเริ่มใช้งาน, เมนูทักทาย มาแล้ว)');
    } catch (error) {
        console.error(error);
        res.status(500).send('❌ ตั้งค่าไม่สำเร็จ: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
    }
});

// Start server
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});
