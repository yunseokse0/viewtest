/**
 * ViewBot 웹 서버
 * Express + Socket.io를 사용한 웹 인터페이스
 */
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

// 루트 경로
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 봇 시작 API
app.post('/api/start', (req, res) => {
    let { url, instances, minDelay, maxDelay, headless } = req.body;
    url = (url && typeof url === 'string') ? url.trim() : '';

    if (!url) {
        return res.status(400).json({ error: 'URL을 입력하거나 붙여넣기 해주세요.' });
    }
    // 프로토콜 없으면 https:// 추가
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    if (currentBot && currentBot.running) {
        return res.status(400).json({ error: '이미 봇이 실행 중입니다.' });
    }

    try {
        const numInstances = Math.min(Math.max(parseInt(instances) || 5, 1), 300);
        
        currentBot = new ViewBot(url, {
            numInstances: numInstances,
            minDelay: parseInt(minDelay) || 5000,
            maxDelay: parseInt(maxDelay) || 15000,
            headless: headless !== false
        });

        // 모든 클라이언트에게 이벤트 전달
        currentBot.on('update', (data) => {
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
            io.emit('update', { type: 'error', message: `오류: ${error.message}` });
        });

        res.json({ success: true, message: '봇이 시작되었습니다.' });
    } catch (error) {
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

// 상태 확인 API
app.get('/api/status', (req, res) => {
    if (currentBot && currentBot.running) {
        res.json({
            running: true,
            stats: currentBot.stats
        });
    } else {
        res.json({
            running: false,
            stats: null
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
    });
}
