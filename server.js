/**
 * ViewBot 웹 서버
 * Express + Socket.io를 사용한 웹 인터페이스
 * 로컬: npm run server → http://localhost:3000 (실제 브라우저 모드 + YouTube 시청자 API)
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const ViewBot = require('./viewbot');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 현재 실행 중인 봇 인스턴스
let currentBot = null;

// 웹·클라이언트용 로그 버퍼 (최근 500개)
const logBuffer = [];
const LOG_BUFFER_MAX = 500;

function pushLog(type, message) {
    logBuffer.push({ type: type || 'info', message: String(message) });
    if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.shift();
}

// 루트 경로
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 백엔드 능력: Puppeteer 사용 가능 → 실제 브라우저·플레이어 로드 (시청자 수 반영 가능)
app.get('/api/capabilities', (req, res) => {
    res.json({ puppeteer: true });
});

// YouTube 라이브 시청자 수 조회 (로컬에서도 시청자 통계 패널 동작)
app.get('/api/youtube-viewers', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const videoId = req.query.videoId;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!videoId) {
        return res.status(400).json({ error: 'videoId 필요', viewerCount: null });
    }
    if (!apiKey) {
        return res.status(500).json({
            error: 'YOUTUBE_API_KEY 환경 변수를 설정하세요. (로컬: .env 또는 터미널에서 export)',
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

// 봇 시작 API
app.post('/api/start', (req, res) => {
    let { url, instances, minDelay, maxDelay, headless, maxConcurrent } = req.body;
    url = (url && typeof url === 'string') ? url.trim() : '';

    if (!url) {
        const msg = 'URL을 입력하거나 붙여넣기 해주세요.';
        pushLog('error', msg);
        return res.status(400).json({ error: msg });
    }
    // 프로토콜 없으면 https:// 추가
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    if (currentBot && currentBot.running) {
        const msg = '이미 봇이 실행 중입니다.';
        pushLog('warning', msg);
        return res.status(400).json({ error: msg });
    }

    try {
        const numInstances = Math.min(Math.max(parseInt(instances) || 5, 1), 300);
        const concurrent = Math.min(Math.max(parseInt(maxConcurrent) || 12, 1), 100); // 한번에 N명씩 (기본 12 = 타임아웃 감소)
        // minDelay/maxDelay: API는 밀리초, 프론트에서 초 단위로 보낼 수 있음 (숫자 < 1000 이면 초로 간주)
        let minMs = parseInt(minDelay) || 5000;
        let maxMs = parseInt(maxDelay) || 15000;
        if (minMs < 1000) minMs *= 1000;
        if (maxMs < 1000) maxMs *= 1000;

        currentBot = new ViewBot(url, {
            numInstances: numInstances,
            maxConcurrent: concurrent,
            minDelay: minMs,
            maxDelay: maxMs,
            headless: headless !== false
        });

        // 모든 클라이언트에게 이벤트 전달 + 로그 버퍼
        currentBot.on('update', (data) => {
            pushLog(data.type, data.message);
            io.emit('update', data);
        });

        currentBot.on('stats', (stats) => {
            io.emit('stats', stats);
        });

        currentBot.on('complete', () => {
            io.emit('complete');
        });

        // 비동기로 시작
        currentBot.start().catch((error) => {
            pushLog('error', `오류: ${error.message}`);
            io.emit('update', { type: 'error', message: `오류: ${error.message}` });
        });

        pushLog('success', '봇이 시작되었습니다.');
        res.json({ success: true, message: '봇이 시작되었습니다.' });
    } catch (error) {
        pushLog('error', `봇 시작 실패: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// 봇 중지 API
app.post('/api/stop', (req, res) => {
    if (currentBot && currentBot.running) {
        currentBot.stop();
        res.json({ success: true, message: '봇이 중지되었습니다.' });
    } else {
        res.json({ success: false, message: '실행 중인 봇이 없습니다.' });
    }
});

// MFC용 로그 조회 (폴링)
app.get('/api/log', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ entries: logBuffer.slice() });
});

// 상태 확인 API (runtime + 최근 로그 현황 포함)
app.get('/api/status', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (currentBot && currentBot.running) {
        const st = currentBot.stats;
        const runtimeSec = st.startTime ? Math.floor((Date.now() - new Date(st.startTime).getTime()) / 1000) : 0;
        const lastLogMessages = logBuffer.slice(-15).map(e => ({ type: e.type, message: e.message }));
        res.json({
            running: true,
            stats: st,
            runtimeSeconds: runtimeSec,
            lastLogMessages
        });
    } else {
        res.json({
            running: false,
            stats: null,
            runtimeSeconds: 0,
            lastLogMessages: logBuffer.slice(-15).map(e => ({ type: e.type, message: e.message }))
        });
    }
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
    console.log('클라이언트 연결됨:', socket.id);

    // 현재 상태 전송
    if (currentBot && currentBot.running) {
        socket.emit('stats', currentBot.stats);
        socket.emit('update', { type: 'info', message: '봇이 실행 중입니다.' });
    }

    socket.on('disconnect', () => {
        console.log('클라이언트 연결 해제:', socket.id);
    });
});

// Vercel 배포 시 자동으로 PORT 할당, 로컬에서는 3000 사용
const PORT = process.env.PORT || 3000;

// Vercel에서는 server.listen을 호출하지 않음 (자동 처리)
if (process.env.VERCEL) {
    // Vercel 환경에서는 export만 필요
    module.exports = app;
} else {
    // 로컬 개발 환경
    server.listen(PORT, () => {
        console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
        pushLog('info', '서버가 시작되었습니다. URL 입력 후 [봇 시작]을 누르세요.');
    });
}
