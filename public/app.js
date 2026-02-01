// Socket.io 연결
const socket = io();

// DOM 요소
const botForm = document.getElementById('botForm');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logContainer = document.getElementById('logContainer');

// 통계 요소
const totalVisitsEl = document.getElementById('totalVisits');
const activeSessionsEl = document.getElementById('activeSessions');
const completedSessionsEl = document.getElementById('completedSessions');
const failedSessionsEl = document.getElementById('failedSessions');
const runtimeEl = document.getElementById('runtime');

let startTime = null;
let runtimeInterval = null;

// 시간 포맷팅
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 런타임 업데이트
function updateRuntime() {
    if (startTime) {
        const elapsed = Math.floor((new Date() - startTime) / 1000);
        runtimeEl.textContent = formatTime(elapsed);
    }
}

// 로그 추가
function addLog(type, message) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString('ko-KR');
    logEntry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 통계 업데이트
function updateStats(stats) {
    totalVisitsEl.textContent = stats.totalVisits || 0;
    activeSessionsEl.textContent = stats.activeSessions || 0;
    completedSessionsEl.textContent = stats.completedSessions || 0;
    failedSessionsEl.textContent = stats.failedSessions || 0;
    
    if (stats.startTime && !startTime) {
        startTime = new Date(stats.startTime);
        runtimeInterval = setInterval(updateRuntime, 1000);
    }
}

// 봇 시작
botForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let instances = parseInt(document.getElementById('instances').value);
    instances = Math.min(Math.max(instances, 1), 300); // 1~300 사이로 제한
    
    const formData = {
        url: document.getElementById('url').value,
        instances: instances,
        minDelay: document.getElementById('minDelay').value * 1000, // 초를 밀리초로 변환
        maxDelay: document.getElementById('maxDelay').value * 1000,
        headless: document.getElementById('headless').checked
    };
    
    try {
        const response = await fetch('/api/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            botForm.querySelectorAll('input').forEach(input => {
                if (input.type !== 'checkbox') input.disabled = true;
            });
            addLog('success', '봇이 시작되었습니다.');
            startTime = new Date();
            runtimeInterval = setInterval(updateRuntime, 1000);
        } else {
            addLog('error', data.error || '봇 시작 실패');
        }
    } catch (error) {
        addLog('error', `오류: ${error.message}`);
    }
});

// 봇 중지
stopBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/stop', {
            method: 'POST'
        });
        
        const data = await response.json();
        addLog('warning', data.message || '봇이 중지되었습니다.');
        
        if (runtimeInterval) {
            clearInterval(runtimeInterval);
            runtimeInterval = null;
        }
        startTime = null;
    } catch (error) {
        addLog('error', `오류: ${error.message}`);
    }
});

// 로그 지우기
clearLogBtn.addEventListener('click', () => {
    logContainer.innerHTML = '';
});

// Socket.io 이벤트 리스너
socket.on('update', (data) => {
    addLog(data.type || 'log', data.message);
});

socket.on('stats', (stats) => {
    updateStats(stats);
});

socket.on('complete', () => {
    addLog('success', '모든 세션이 완료되었습니다.');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    botForm.querySelectorAll('input').forEach(input => {
        input.disabled = false;
    });
    
    if (runtimeInterval) {
        clearInterval(runtimeInterval);
        runtimeInterval = null;
    }
    startTime = null;
    runtimeEl.textContent = '00:00:00';
});

// 페이지 로드 시 상태 확인
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.running) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            botForm.querySelectorAll('input').forEach(input => {
                if (input.type !== 'checkbox') input.disabled = true;
            });
            updateStats(data.stats);
            if (data.stats.startTime) {
                startTime = new Date(data.stats.startTime);
                runtimeInterval = setInterval(updateRuntime, 1000);
            }
        }
    } catch (error) {
        console.error('상태 확인 실패:', error);
    }
});
