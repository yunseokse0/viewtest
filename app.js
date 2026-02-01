/**
 * ViewBot - 프론트엔드 전용 (서버 없음)
 * URL을 설정한 만큼 새 탭으로 열어 접속을 시뮬레이션합니다.
 */

// DOM 요소
const botForm = document.getElementById('botForm');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logContainer = document.getElementById('logContainer');

const totalVisitsEl = document.getElementById('totalVisits');
const activeSessionsEl = document.getElementById('activeSessions');
const completedSessionsEl = document.getElementById('completedSessions');
const failedSessionsEl = document.getElementById('failedSessions');
const runtimeEl = document.getElementById('runtime');

let startTime = null;
let runtimeInterval = null;
let isRunning = false;
let timeouts = []; // 중지 시 clearTimeout용

// 시간 포맷 (초 → HH:MM:SS)
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateRuntime() {
    if (startTime) {
        const elapsed = Math.floor((new Date() - startTime) / 1000);
        runtimeEl.textContent = formatTime(elapsed);
    }
}

function addLog(type, message) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('ko-KR');
    logEntry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateStats(opened, pending, blocked) {
    const target = parseInt(document.getElementById('instances').value) || 0;
    totalVisitsEl.textContent = target;
    activeSessionsEl.textContent = pending;
    completedSessionsEl.textContent = opened;
    failedSessionsEl.textContent = blocked;
}

// 랜덤 지연 (초 → 밀리초)
function randomDelaySec(minSec, maxSec) {
    const min = Math.min(minSec, maxSec) * 1000;
    const max = Math.max(minSec, maxSec) * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function run() {
    let url = document.getElementById('url').value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    if (!url) {
        addLog('error', 'URL을 입력하거나 붙여넣기 해주세요.');
        return;
    }
    document.getElementById('url').value = url;

    let instances = parseInt(document.getElementById('instances').value);
    instances = Math.min(Math.max(instances, 1), 1000);

    const minDelay = parseInt(document.getElementById('minDelay').value) || 0;
    const maxDelay = Math.max(parseInt(document.getElementById('maxDelay').value) || 0, minDelay);

    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    botForm.querySelectorAll('input').forEach(function (input) {
        if (input.type !== 'checkbox') input.disabled = true;
    });

    startTime = new Date();
    runtimeInterval = setInterval(updateRuntime, 1000);
    timeouts = [];

    let opened = 0;
    let blocked = 0;
    const target = instances;

    addLog('success', '시작: ' + url + ' (탭 ' + target + '개)');

    function openOne(index) {
        if (!isRunning) return;

        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) {
            opened++;
            addLog('success', '탭 #' + (index + 1) + ' 열림');
        } else {
            blocked++;
            addLog('warning', '탭 #' + (index + 1) + ' 차단됨 (팝업 허용 후 다시 시도)');
        }

        updateStats(opened, target - opened - blocked, blocked);

        if (opened + blocked >= target) {
            finish();
            return;
        }

        const nextIndex = index + 1;
        const delay = randomDelaySec(minDelay, maxDelay);
        const t = setTimeout(function () {
            openOne(nextIndex);
        }, delay);
        timeouts.push(t);
    }

    function finish() {
        isRunning = false;
        timeouts.forEach(clearTimeout);
        timeouts = [];
        if (runtimeInterval) {
            clearInterval(runtimeInterval);
            runtimeInterval = null;
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
        botForm.querySelectorAll('input').forEach(function (input) {
            input.disabled = false;
        });
        addLog('success', '완료: 열린 탭 ' + opened + '개' + (blocked ? ', 차단 ' + blocked + '개' : ''));
        runtimeEl.textContent = formatTime(Math.floor((new Date() - startTime) / 1000));
        startTime = null;
    }

    updateStats(0, target, 0);

    if (instances > 0) {
        openOne(0);
    } else {
        finish();
    }
}

botForm.addEventListener('submit', function (e) {
    e.preventDefault();
    run();
});

stopBtn.addEventListener('click', function () {
    if (!isRunning) return;
    isRunning = false;
    timeouts.forEach(clearTimeout);
    timeouts = [];
    if (runtimeInterval) {
        clearInterval(runtimeInterval);
        runtimeInterval = null;
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    botForm.querySelectorAll('input').forEach(function (input) {
        input.disabled = false;
    });
    addLog('warning', '사용자가 중지했습니다.');
    if (startTime) {
        runtimeEl.textContent = formatTime(Math.floor((new Date() - startTime) / 1000));
    }
    startTime = null;
});

clearLogBtn.addEventListener('click', function () {
    logContainer.innerHTML = '';
});

// 초기 통계
updateStats(0, 0, 0);
