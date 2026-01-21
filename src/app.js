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

// Setup Profile Endpoint removed per user request

// Start server
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});
