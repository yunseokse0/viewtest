/**
 * Vercel Serverless: 백엔드 능력 (Puppeteer 없음 → 요청 전송만)
 */
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ puppeteer: false });
};
