require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    fb: {
        pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
        verifyToken: process.env.FB_VERIFY_TOKEN,
        appSecret: process.env.FB_APP_SECRET,
    },
    google: {
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        sheetId: process.env.GOOGLE_SHEET_ID,
    },
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300,
};
