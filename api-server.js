/**
 * Vercel 전용 서버: 정적 파일 + /api/youtube-viewers
 * api 폴더 404 없이 시청자 API가 동작하도록 함
 */
const express = require('express');
const path = require('path');

const app = express();

// 정적 파일 (루트의 index.html, app.js, style.css)
app.use(express.static(path.join(__dirname)));

// 백엔드 능력: Puppeteer 없음 → 요청 전송만 (시청자 수 미반영)
app.get('/api/capabilities', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ puppeteer: false });
});

// /api/youtube-viewers - YouTube 라이브 시청자 수
app.get('/api/youtube-viewers', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const videoId = req.query.videoId;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!videoId) {
        return res.status(400).json({ error: 'videoId 필요', viewerCount: null });
    }
    if (!apiKey) {
        return res.status(500).json({
            error: 'YOUTUBE_API_KEY가 Vercel 환경 변수에 설정되지 않았습니다.',
            viewerCount: null
        });
    }

    const url = 'https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=' +
        encodeURIComponent(videoId) + '&key=' + encodeURIComponent(apiKey);

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                return res.status(400).json({
                    error: data.error.message || 'YouTube API 오류',
                    viewerCount: null
                });
            }
            const item = data.items && data.items[0];
            if (!item || !item.liveStreamingDetails) {
                return res.status(200).json({
                    error: '라이브 방송이 아니거나 시청자 수를 사용할 수 없습니다.',
                    viewerCount: null
                });
            }
            const n = item.liveStreamingDetails.concurrentViewers;
            const parsed = n != null ? parseInt(n, 10) : NaN;
            const viewerCount = (parsed === parsed && parsed >= 0) ? parsed : null;
            res.status(200).json({ viewerCount, error: null });
        })
        .catch(err => {
            res.status(500).json({
                error: err.message || '서버 오류',
                viewerCount: null
            });
        });
});

// 루트는 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 로컬 실행 시: node api-server.js → http://localhost:3000 에서 앱 + API 동작
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, function () {
        console.log('ViewBot 로컬 서버: http://localhost:' + PORT);
        console.log('  - 앱: /');
        console.log('  - YouTube 시청자 API: /api/youtube-viewers?videoId=...');
    });
}

module.exports = app;
