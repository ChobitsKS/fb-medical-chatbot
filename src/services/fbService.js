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

/**
 * Send image to user
 * @param {string} recipientId 
 * @param {string} imageUrl 
 */
const sendImage = async (recipientId, imageUrl) => {
    try {
        await axios.post(`${FACEBOOK_API_URL}/me/messages`, {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "image",
                    payload: {
                        url: imageUrl,
                        is_reusable: true
                    }
                },
                metadata: "bot_reply"
            },
            access_token: config.fb.pageAccessToken
        }, {
            params: { access_token: config.fb.pageAccessToken }
        });
    } catch (error) {
        console.error('Error sending image to Facebook:', error.response ? error.response.data : error.message);
    }
};

/**
 * Send Generic Template (Carousel)
 * @param {string} recipientId 
 * @param {Array} elements - Array of template elements
 */
const sendGenericTemplate = async (recipientId, elements) => {
    try {
        await axios.post(`${FACEBOOK_API_URL}/me/messages`, {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: elements
                    }
                },
                metadata: "bot_reply"
            },
            access_token: config.fb.pageAccessToken
        }, {
            params: { access_token: config.fb.pageAccessToken }
        });
    } catch (error) {
        console.error('Error sending generic template to Facebook:', error.response ? error.response.data : error.message);
    }
};

/**
 * Send Button Template (Ordinary Menu)
 * @param {string} recipientId 
 * @param {string} text - Message text
 * @param {Array} buttons - Array of button objects
 */
const sendButtonTemplate = async (recipientId, text, buttons) => {
    try {
        await axios.post(`${FACEBOOK_API_URL}/me/messages`, {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: text,
                        buttons: buttons
                    }
                },
                metadata: "bot_reply"
            },
            access_token: config.fb.pageAccessToken
        }, {
            params: { access_token: config.fb.pageAccessToken }
        });
    } catch (error) {
        console.error('Error sending button template to Facebook:', error.response ? error.response.data : error.message);
    }
};

module.exports = {
    sendMessage,
    sendTyping,
    sendImage,
    sendGenericTemplate,
    sendButtonTemplate
};
