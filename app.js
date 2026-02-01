/**
 * ViewBot - 프론트엔드 전용 (서버 없음)
 * URL을 설정한 만큼 백그라운드에서 요청만 보냅니다. (팝업/탭 열지 않음)
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

const viewerCountPanel = document.getElementById('viewerCountPanel');
const initialViewerCountEl = document.getElementById('initialViewerCount');
const currentViewerCountEl = document.getElementById('currentViewerCount');
const viewerChangeEl = document.getElementById('viewerChange');

let startTime = null;
let runtimeInterval = null;
let isRunning = false;
let timeouts = []; // 중지 시 clearTimeout용
let viewerPollInterval = null; // YouTube 시청자 수 폴링

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

function updateStats(completed, pending, failed) {
    const target = parseInt(document.getElementById('instances').value) || 0;
    totalVisitsEl.textContent = target;
    activeSessionsEl.textContent = pending;
    completedSessionsEl.textContent = completed;
    failedSessionsEl.textContent = failed;
}

// 랜덤 지연 (초 → 밀리초)
function randomDelaySec(minSec, maxSec) {
    const min = Math.min(minSec, maxSec) * 1000;
    const max = Math.max(minSec, maxSec) * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// YouTube URL에서 비디오 ID 추출
function getYouTubeVideoId(url) {
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) return null;
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null;
        return u.searchParams.get('v') || null;
    } catch (e) {
        return null;
    }
}

// 서버 API로 YouTube 라이브 시청자 수 조회 (Vercel 환경변수 YOUTUBE_API_KEY 사용)
function fetchYouTubeViewerCount(videoId) {
    if (!videoId) return Promise.resolve({ viewerCount: null, error: null });
    const url = '/api/youtube-viewers?videoId=' + encodeURIComponent(videoId);
    return fetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var n = data.viewerCount != null ? parseInt(data.viewerCount, 10) : null;
            if (n !== null && (isNaN(n) || n < 0)) n = null;
            return { viewerCount: n, error: data.error || null };
        })
        .catch(function (err) {
            return { viewerCount: null, error: err.message || '요청 실패' };
        });
}

// 시청자 통계 UI 업데이트 (초기값·현재값·증감 모두 반영)
function updateViewerStats(initial, current) {
    if (!viewerCountPanel) return;
    var validInitial = initial != null && !isNaN(initial) && initial >= 0;
    var validCurrent = current != null && !isNaN(current) && current >= 0;
    if (validInitial) {
        initialViewerCountEl.textContent = initial.toLocaleString() + '명';
    } else {
        initialViewerCountEl.textContent = '-';
    }
    if (validCurrent) {
        currentViewerCountEl.textContent = current.toLocaleString() + '명';
        if (validInitial) {
            var change = current - initial;
            viewerChangeEl.textContent = (change >= 0 ? '+' : '') + change.toLocaleString() + '명';
            viewerChangeEl.style.color = change >= 0 ? '#2ecc71' : '#e74c3c';
        } else {
            viewerChangeEl.textContent = '-';
        }
    } else {
        currentViewerCountEl.textContent = '-';
        viewerChangeEl.textContent = '-';
    }
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

    addLog('success', '시작: ' + url + ' (요청 ' + target + '개, 팝업 없음)');

    // YouTube 시청자 통계 (Vercel 환경변수 YOUTUBE_API_KEY 사용)
    const videoId = getYouTubeVideoId(url);
    let initialViewerCount = null;
    let lastViewerCount = null;

    if (videoId) {
        initialViewerCountEl.textContent = '조회 중...';
        currentViewerCountEl.textContent = '-';
        viewerChangeEl.textContent = '-';
        fetchYouTubeViewerCount(videoId).then(function (result) {
            var n = result.viewerCount;
            initialViewerCount = n;
            lastViewerCount = n;
            updateViewerStats(initialViewerCount, lastViewerCount);
            if (n != null) addLog('info', '시작 시청자 수: ' + n.toLocaleString() + '명');
            else addLog('warning', result.error || '시청자 수를 가져올 수 없습니다. 라이브 중인지, Vercel에 YOUTUBE_API_KEY 설정을 확인하세요.');
            // 초기값 확정 후에만 주기 폴링 시작 → 증가분이 항상 올바르게 표시됨
            if (!viewerPollInterval) {
                viewerPollInterval = setInterval(function () {
                    if (!isRunning) return;
                    fetchYouTubeViewerCount(videoId).then(function (res) {
                        if (res.viewerCount != null) {
                            lastViewerCount = res.viewerCount;
                            updateViewerStats(initialViewerCount, lastViewerCount);
                        }
                    });
                }, 15000); // 15초마다 갱신
            }
        });
    }

    function sendOne(index) {
        if (!isRunning) return;

        fetch(url, { method: 'GET', credentials: 'omit' })
            .then(function (res) {
                return { ok: res.ok, status: res.status };
            })
            .then(function (info) {
                if (!isRunning) return;
                opened++;
                if (info.ok) {
                    addLog('success', '요청 #' + (index + 1) + ' 성공 (' + info.status + ')');
                } else {
                    addLog('warning', '요청 #' + (index + 1) + ' 응답 ' + info.status);
                }
                updateStats(opened, target - opened - blocked, blocked);
                scheduleNext(index);
            })
            .catch(function (err) {
                if (!isRunning) return;
                blocked++;
                var msg = err && err.message ? err.message : 'CORS/네트워크';
                addLog('warning', '요청 #' + (index + 1) + ' 실패: ' + msg);
                updateStats(opened, target - opened - blocked, blocked);
                scheduleNext(index);
            });
    }

    function scheduleNext(index) {
        if (!isRunning) return;
        if (opened + blocked >= target) {
            finish();
            return;
        }
        const nextIndex = index + 1;
        const delay = randomDelaySec(minDelay, maxDelay);
        const t = setTimeout(function () {
            sendOne(nextIndex);
        }, delay);
        timeouts.push(t);
    }

    function finish() {
        isRunning = false;
        timeouts.forEach(clearTimeout);
        timeouts = [];
        if (viewerPollInterval) {
            clearInterval(viewerPollInterval);
            viewerPollInterval = null;
        }
        if (runtimeInterval) {
            clearInterval(runtimeInterval);
            runtimeInterval = null;
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
        botForm.querySelectorAll('input').forEach(function (input) {
            input.disabled = false;
        });
        addLog('success', '완료: 전송 ' + opened + '개' + (blocked ? ', 실패 ' + blocked + '개' : ''));
        runtimeEl.textContent = formatTime(Math.floor((new Date() - startTime) / 1000));
        startTime = null;
    }

    updateStats(0, target, 0);

    if (instances > 0) {
        sendOne(0);
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
    if (viewerPollInterval) {
        clearInterval(viewerPollInterval);
        viewerPollInterval = null;
    }
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
