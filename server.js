require('dotenv').config({ path: __dirname + '/.env.local' });
/**
 * ViewBot 웹 서버
 * Express + Socket.io를 사용한 웹 인터페이스
 */
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
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
    const { 
        url, 
        instances, 
        minDelay, 
        maxDelay, 
        headless, 
        playMuted,
        autoViewerManagement,
        targetViewerCount,
        minViewerCount,
        maxViewerCount,
        viewerCheckInterval,
        increaseDuration,
        decreaseDuration,
        maxCycles
    } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL이 필요합니다.' });
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
            headless: headless !== false,
            playMuted: playMuted !== false,
            autoViewerManagement: autoViewerManagement !== false,
            targetViewerCount: parseInt(targetViewerCount) || 25,
            minViewerCount: parseInt(minViewerCount) || 20,
            maxViewerCount: parseInt(maxViewerCount) || 35,
            viewerCheckInterval: parseInt(viewerCheckInterval) || 30000,
            increaseDuration: parseInt(increaseDuration) || 300000,
            decreaseDuration: parseInt(decreaseDuration) || 300000,
            maxCycles: parseInt(maxCycles) || 3
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
app.post('/api/proxies/update', (req, res) => {
    const { proxies } = req.body || {};
    if (!Array.isArray(proxies) || proxies.length === 0) {
        return res.status(400).json({ error: '프록시 목록이 필요합니다.' });
    }
    try {
        const list = proxies.map(s => String(s).trim()).filter(Boolean);
        process.env.PROXY_LIST = list.join(', ');
        if (currentBot) {
            currentBot.setProxies(list);
        }
        const envPath = path.join(__dirname, '.env.local');
        let content = '';
        try { content = fs.readFileSync(envPath, 'utf8'); } catch (_) {}
        if (content.includes('PROXY_LIST=')) {
            content = content.replace(/PROXY_LIST=.*?/g, `PROXY_LIST=${list.join(', ')}`);
        } else {
            content += `\nPROXY_LIST=${list.join(', ')}\n`;
        }
        fs.writeFileSync(envPath, content);
        res.json({ success: true, count: list.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/proxies/stats', (req, res) => {
    if (!currentBot) return res.json({ running: false, stats: null });
    const snap = currentBot.getProxyStatsSnapshot();
    res.json({ running: currentBot.running, ...snap });
});

app.post('/api/proxies/clear-blacklist', (req, res) => {
    if (currentBot) {
        currentBot.proxyBlacklist = new Set();
    }
    res.json({ success: true });
});

app.post('/api/proxies/purge', (req, res) => {
    const { threshold } = req.body || {};
    if (!currentBot) return res.status(400).json({ error: '봇이 실행 중이 아닙니다.' });
    const t = parseInt(threshold) || 2;
    const result = currentBot.purgeFailingProxies(t);
    process.env.PROXY_LIST = currentBot.proxies.join(', ');
    try {
        const envPath = path.join(__dirname, '.env.local');
        let content = '';
        try { content = fs.readFileSync(envPath, 'utf8'); } catch (_) {}
        if (content.includes('PROXY_LIST=')) {
            content = content.replace(/PROXY_LIST=.*?/g, `PROXY_LIST=${currentBot.proxies.join(', ')}`);
        } else {
            content += `\nPROXY_LIST=${currentBot.proxies.join(', ')}\n`;
        }
        fs.writeFileSync(envPath, content);
    } catch (_) {}
    res.json({ success: true, ...result, list: currentBot.proxies });
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
