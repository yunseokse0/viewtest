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

// 시청자 수 요소
const viewerCountPanel = document.getElementById('viewerCountPanel');
const initialViewerCountEl = document.getElementById('initialViewerCount');
const currentViewerCountEl = document.getElementById('currentViewerCount');
const viewerChangeEl = document.getElementById('viewerChange');
const viewerChartCanvas = document.getElementById('viewerChart');

let startTime = null;
let runtimeInterval = null;
let viewerChart = null;
let currentUrl = '';

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
    
    const hasViewerStats = stats.viewerHistory && stats.viewerHistory.length > 0;
    const hasViewerCounts = stats.initialViewerCount !== null || stats.currentViewerCount !== null;
    const urlValue = currentUrl || document.getElementById('url').value || '';
    const isYouTube = urlValue.includes('youtube.com') || urlValue.includes('youtu.be');
    
    if ((isYouTube && (hasViewerStats || hasViewerCounts)) || hasViewerStats || hasViewerCounts) {
        updateViewerStats(stats);
    }
}

// 시청자 수 통계 업데이트
function updateViewerStats(stats) {
    if (stats.initialViewerCount !== null || stats.currentViewerCount !== null) {
        viewerCountPanel.style.display = 'block';
        
        if (stats.initialViewerCount !== null) {
            initialViewerCountEl.textContent = stats.initialViewerCount.toLocaleString() + '명';
        }
        
        if (stats.currentViewerCount !== null) {
            currentViewerCountEl.textContent = stats.currentViewerCount.toLocaleString() + '명';
            
            // 변화량 계산
            if (stats.initialViewerCount !== null) {
                const change = stats.currentViewerCount - stats.initialViewerCount;
                viewerChangeEl.textContent = (change >= 0 ? '+' : '') + change.toLocaleString() + '명';
                viewerChangeEl.style.color = change >= 0 ? '#2ecc71' : '#e74c3c';
            }
        }
        
        // 그래프 업데이트
        if (stats.viewerHistory && stats.viewerHistory.length > 0) {
            updateViewerChart(stats.viewerHistory, stats.initialViewerCount);
        }
    }
}

// 시청자 수 그래프 업데이트
function updateViewerChart(history, initialCount) {
    if (!viewerChart) {
        const ctx = viewerChartCanvas.getContext('2d');
        viewerChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '시청자 수',
                    data: [],
                    borderColor: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }, {
                    label: '시작 시청자 수',
                    data: [],
                    borderColor: '#606060',
                    borderDash: [5, 5],
                    borderWidth: 1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#d0d0d0'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#2a2a2a',
                        titleColor: '#ffffff',
                        bodyColor: '#d0d0d0',
                        borderColor: '#404040',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#a0a0a0'
                        },
                        grid: {
                            color: '#3a3a3a'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        ticks: {
                            color: '#a0a0a0',
                            callback: function(value) {
                                return value.toLocaleString() + '명';
                            }
                        },
                        grid: {
                            color: '#3a3a3a'
                        }
                    }
                }
            }
        });
    }
    
    const labels = history.map((item, index) => {
        const date = new Date(item.time);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    
    const data = history.map(item => item.count);
    const baseline = new Array(history.length).fill(initialCount || 0);
    
    viewerChart.data.labels = labels;
    viewerChart.data.datasets[0].data = data;
    viewerChart.data.datasets[1].data = baseline;
    viewerChart.update('none'); // 애니메이션 없이 업데이트
}

// 봇 시작
botForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let instances = parseInt(document.getElementById('instances').value);
    instances = Math.min(Math.max(instances, 1), 300); // 1~300 사이로 제한
    
    const url = document.getElementById('url').value;
    currentUrl = url;
    
    // YouTube URL인지 확인하여 시청자 수 패널 표시
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        viewerCountPanel.style.display = 'block';
        // 그래프 초기화
        if (viewerChart) {
            viewerChart.destroy();
            viewerChart = null;
        }
    } else {
        viewerCountPanel.style.display = 'none';
    }
    
    const formData = {
        url: url,
        instances: instances,
        minDelay: document.getElementById('minDelay').value * 1000, // 초를 밀리초로 변환
        maxDelay: document.getElementById('maxDelay').value * 1000,
        headless: document.getElementById('headless').checked,
        playMuted: document.getElementById('playMuted').checked,
        // 자동 시청자 수 관리 설정
        autoViewerManagement: document.getElementById('autoViewerManagement').checked,
        targetViewerCount: document.getElementById('targetViewerCount').value,
        minViewerCount: document.getElementById('minViewerCount').value,
        maxViewerCount: document.getElementById('maxViewerCount').value,
        viewerCheckInterval: document.getElementById('viewerCheckInterval').value * 1000,
        increaseDuration: document.getElementById('increaseDuration').value * 1000,
        decreaseDuration: document.getElementById('decreaseDuration').value * 1000,
        maxCycles: document.getElementById('maxCycles').value
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

const proxyForm = document.getElementById('proxyForm');
if (proxyForm) {
    proxyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const text = document.getElementById('proxiesText').value || '';
            const items = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            const res = await fetch('/api/proxies/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxies: items })
            });
            const data = await res.json();
            if (res.ok) {
                addLog('success', `프록시 업데이트 완료: ${data.count}개`);
            } else {
                addLog('error', data.error || '프록시 업데이트 실패');
            }
        } catch (err) {
            addLog('error', `오류: ${err.message}`);
        }
    });
}

const clearProxyBlacklistBtn = document.getElementById('clearProxyBlacklistBtn');
if (clearProxyBlacklistBtn) {
    clearProxyBlacklistBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/proxies/clear-blacklist', { method: 'POST' });
            if (res.ok) {
                addLog('success', '프록시 블랙리스트를 초기화했습니다.');
            }
        } catch (err) {
            addLog('error', `오류: ${err.message}`);
        }
    });
}

// 자동 시청자 수 관리 체크박스 이벤트
const autoViewerManagementCheckbox = document.getElementById('autoViewerManagement');
const viewerManagementOptions = document.querySelector('.viewer-management-options');

if (autoViewerManagementCheckbox && viewerManagementOptions) {
    autoViewerManagementCheckbox.addEventListener('change', function() {
        viewerManagementOptions.style.display = this.checked ? 'block' : 'none';
        
        // YouTube URL이 아닌 경우 경고
        const url = document.getElementById('url').value;
        if (this.checked && !url.includes('youtube.com') && !url.includes('youtu.be')) {
            addLog('warning', '⚠️ 자동 시청자 수 관리는 YouTube URL에서만 작동합니다.');
        }
    });
}

// URL 변경 시 자동 시청자 수 관리 체크박스 상태 확인
document.getElementById('url').addEventListener('input', function() {
    if (autoViewerManagementCheckbox && autoViewerManagementCheckbox.checked) {
        if (!this.value.includes('youtube.com') && !this.value.includes('youtu.be')) {
            addLog('warning', '⚠️ 자동 시청자 수 관리는 YouTube URL에서만 작동합니다.');
        }
    }
});

const purgeFailingBtn = document.getElementById('purgeFailingBtn');
if (purgeFailingBtn) {
    purgeFailingBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/proxies/purge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold: 2 })
            });
            const data = await res.json();
            if (res.ok) {
                addLog('success', `실패 프록시 제거: ${data.removed}개, 남은 ${data.remaining}개`);
            } else {
                addLog('error', data.error || '실패 프록시 제거 실패');
            }
        } catch (err) {
            addLog('error', `오류: ${err.message}`);
        }
    });
}
