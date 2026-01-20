const axios = require('axios');
const config = require('../config');

const FACEBOOK_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send text message to user
 * @param {string} recipientId 
 * @param {string} text 
 */
const sendMessage = async (recipientId, text) => {
    try {
        await axios.post(`${FACEBOOK_API_URL}/me/messages`, {
            recipient: { id: recipientId },
            message: {
                text: text,
                metadata: "bot_reply"
            },
            access_token: config.fb.pageAccessToken
        }, {
            params: { access_token: config.fb.pageAccessToken }
        });
    } catch (error) {
        console.error('Error sending message to Facebook:', error.response ? error.response.data : error.message);
    }
};

/**
 * Send typing indicator (visual feedback)
 * @param {string} recipientId 
 */
const sendTyping = async (recipientId) => {
    try {
        await axios.post(`${FACEBOOK_API_URL}/me/messages`, {
            recipient: { id: recipientId },
            sender_action: 'typing_on',
            access_token: config.fb.pageAccessToken
        }, {
            params: { access_token: config.fb.pageAccessToken }
        });
    } catch (error) {
        // Ignore typing errors, not critical
        // console.error('Error sending typing indicator:', error);
    }
};

module.exports = {
    sendMessage,
    sendTyping
};
