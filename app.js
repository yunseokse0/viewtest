/**
 * ViewBot - 분석 문서 기준 두 모드 지원
 * 1) Puppeteer 모드 (npm run server): 실제 브라우저·플레이어 로드 → 시청자 수 반영 가능
 * 2) 요청 전송만 (Vercel/api-server): fetch no-cors → 시청자 수 미반영
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
const viewerCountErrorEl = document.getElementById('viewerCountError');
const viewerResultEl = document.getElementById('viewerResult');

const modeNoticeEl = document.getElementById('modeNotice');

let startTime = null;
let runtimeInterval = null;
let isRunning = false;
let timeouts = []; // 중지 시 clearTimeout용
let viewerPollInterval = null; // YouTube 시청자 수 폴링
let usePuppeteer = false; // /api/capabilities 에서 설정
let socket = null; // Puppeteer 모드 시 Socket.io

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
        .then(function (res) {
            return res.json().then(function (data) {
                return { ok: res.ok, status: res.status || 0, data: data };
            }).catch(function () {
                return { ok: false, status: res.status, data: { viewerCount: null, error: 'API 응답 오류 (status ' + res.status + '). 404면 Vercel 배포 설정 확인.' } };
            });
        })
        .then(function (result) {
            var data = result.data;
            var n = data.viewerCount != null ? parseInt(data.viewerCount, 10) : null;
            if (n !== null && (isNaN(n) || n < 0)) n = null;
            var err = data.error || (result.ok ? null : 'API 오류 (status ' + (result.status || '') + ')');
            if (result.status === 404) err = (err || '') + ' → Vercel 대시보드에서 api 폴더 배포 여부 확인.';
            if (result.status === 500 && data.error && data.error.indexOf('YOUTUBE_API_KEY') !== -1) err = (err || '') + ' → Vercel 환경변수 YOUTUBE_API_KEY 추가 후 재배포.';
            return { viewerCount: n, error: err };
        })
        .catch(function (err) {
            return { viewerCount: null, error: err.message || '요청 실패 (API 라우트 확인)' };
        });
}

// 시청자 통계 오류 메시지 표시
function setViewerCountError(msg) {
    if (viewerCountErrorEl) {
        viewerCountErrorEl.textContent = msg || '';
        viewerCountErrorEl.style.display = msg ? 'block' : 'none';
    }
}

// 시청자 통계 UI 업데이트 (초기값·현재값·증감·결과 메시지)
function updateViewerStats(initial, current, onFirstIncrease) {
    if (!viewerCountPanel) return;
    setViewerCountError('');
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
            // 결과 문구: 이 방송에서 시청자 증가 성공 여부
            if (viewerResultEl) {
                if (change > 0) {
                    viewerResultEl.innerHTML = '✅ <strong>이 방송에서 시청자 증가 감지</strong> (+' + change.toLocaleString() + '명)';
                    viewerResultEl.className = 'viewer-result viewer-result-success';
                    if (typeof onFirstIncrease === 'function') onFirstIncrease(change);
                } else if (change < 0) {
                    viewerResultEl.innerHTML = '❌ 이 방송 시청자 감소 (' + change.toLocaleString() + '명)';
                    viewerResultEl.className = 'viewer-result viewer-result-decrease';
                } else {
                    viewerResultEl.innerHTML = '⏳ 변화 없음 (아직 반영 전이거나 요청 미반영)';
                    viewerResultEl.className = 'viewer-result viewer-result-wait';
                }
            }
        } else if (viewerResultEl) {
            viewerResultEl.innerHTML = '';
            viewerResultEl.className = 'viewer-result';
        }
    } else {
        currentViewerCountEl.textContent = '-';
        viewerChangeEl.textContent = '-';
        if (viewerResultEl) { viewerResultEl.innerHTML = ''; viewerResultEl.className = 'viewer-result'; }
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
    instances = Math.min(Math.max(instances, 1), usePuppeteer ? 300 : 1000);

    const minDelay = parseInt(document.getElementById('minDelay').value) || 0;
    const maxDelay = Math.max(parseInt(document.getElementById('maxDelay').value) || 0, minDelay);

    if (usePuppeteer) {
        runPuppeteerMode(url, instances, minDelay, maxDelay);
    } else {
        runFetchMode(url, instances, minDelay, maxDelay);
    }
}

// Puppeteer 모드: 실제 브라우저·플레이어 로드 → 시청자 수 반영 가능
function runPuppeteerMode(url, instances, minDelaySec, maxDelaySec) {
    const minMs = minDelaySec < 1000 ? minDelaySec * 1000 : minDelaySec;
    const maxMs = maxDelaySec < 1000 ? maxDelaySec * 1000 : maxDelaySec;

    fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: url,
            instances: instances,
            minDelay: minMs,
            maxDelay: maxMs,
            headless: true
        })
    })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
            if (!result.ok) {
                addLog('error', result.data.error || '봇 시작 실패');
                return;
            }
            isRunning = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            botForm.querySelectorAll('input').forEach(function (input) {
                if (input.type !== 'checkbox') input.disabled = true;
            });
            startTime = new Date();
            runtimeInterval = setInterval(updateRuntime, 1000);
            addLog('success', '시작: ' + url + ' (실제 브라우저 ' + instances + '개, 플레이어 로드)');
            updateStats(0, instances, 0);

            // Puppeteer 모드에서도 시청자 통계 표시 (서버 /api/youtube-viewers + .env YOUTUBE_API_KEY)
            var videoId = getYouTubeVideoId(url);
            var initialViewerCount = null;
            var lastViewerCount = null;
            var hasLoggedViewerIncrease = false;
            if (videoId) {
                if (initialViewerCountEl) initialViewerCountEl.textContent = '조회 중...';
                if (currentViewerCountEl) currentViewerCountEl.textContent = '-';
                if (viewerChangeEl) viewerChangeEl.textContent = '-';
                if (viewerResultEl) viewerResultEl.innerHTML = '';
                fetchYouTubeViewerCount(videoId).then(function (result) {
                    var n = result.viewerCount;
                    initialViewerCount = n;
                    lastViewerCount = n;
                    updateViewerStats(initialViewerCount, lastViewerCount);
                    if (n != null) {
                        addLog('info', '시작 시청자 수: ' + n.toLocaleString() + '명');
                        setViewerCountError('');
                    } else {
                        var errMsg = result.error || '시청자 수를 가져올 수 없습니다.';
                        setViewerCountError('⚠ ' + errMsg);
                        addLog('warning', errMsg + ' (라이브 URL·.env YOUTUBE_API_KEY 확인)');
                    }
                    if (!viewerPollInterval) {
                        viewerPollInterval = setInterval(function () {
                            if (!isRunning) return;
                            fetchYouTubeViewerCount(videoId).then(function (res) {
                                if (res.viewerCount != null) {
                                    lastViewerCount = res.viewerCount;
                                    updateViewerStats(initialViewerCount, lastViewerCount, function (change) {
                                        if (!hasLoggedViewerIncrease) {
                                            hasLoggedViewerIncrease = true;
                                            addLog('success', '✅ [이 방송] 시청자 수 증가 감지: 시작 ' + initialViewerCount.toLocaleString() + '명 → 현재 ' + lastViewerCount.toLocaleString() + '명 (+' + change.toLocaleString() + '명)');
                                        }
                                    });
                                }
                            });
                        }, 15000);
                    }
                });
            }

            function connectSocket() {
                if (typeof io === 'undefined') {
                    var s = document.createElement('script');
                    s.src = '/socket.io/socket.io.js';
                    s.onload = connectSocket;
                    document.head.appendChild(s);
                    return;
                }
                socket = io();
                socket.on('update', function (data) {
                    addLog(data.type || 'info', data.message || '');
                });
                socket.on('stats', function (stats) {
                    if (stats && totalVisitsEl) {
                        totalVisitsEl.textContent = stats.totalVisits != null ? stats.totalVisits : instances;
                        activeSessionsEl.textContent = stats.activeSessions != null ? stats.activeSessions : 0;
                        completedSessionsEl.textContent = stats.completedSessions != null ? stats.completedSessions : 0;
                        failedSessionsEl.textContent = stats.failedSessions != null ? stats.failedSessions : 0;
                    }
                });
                socket.on('complete', function () {
                    finishPuppeteer();
                });
            }
            connectSocket();
        })
        .catch(function (err) {
            addLog('error', err.message || '서버 연결 실패. npm run server 로 실행 중인지 확인하세요.');
        });
}

function finishPuppeteer() {
    isRunning = false;
    if (viewerPollInterval) {
        clearInterval(viewerPollInterval);
        viewerPollInterval = null;
    }
    if (socket) {
        socket.disconnect();
        socket = null;
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
    if (startTime) {
        runtimeEl.textContent = formatTime(Math.floor((new Date() - startTime) / 1000));
    }
    startTime = null;
    addLog('success', '완료 (실제 브라우저 모드)');
}

// 요청 전송만 모드: fetch no-cors → 시청자 수 미반영 (분석 문서 참고)
function runFetchMode(url, instances, minDelay, maxDelay) {
    const target = instances;

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

    addLog('success', '시작: ' + url + ' (요청 ' + target + '개)');
    addLog('info', '모드: 요청 전송만 · 시청자 수는 증가하지 않습니다. 실제 반영을 원하면 로컬에서 npm run server 로 실행하세요.');

    // YouTube 시청자 통계 (Vercel 환경변수 YOUTUBE_API_KEY 사용)
    const videoId = getYouTubeVideoId(url);
    let initialViewerCount = null;
    let lastViewerCount = null;
    var hasLoggedViewerIncrease = false;

    if (videoId) {
        initialViewerCountEl.textContent = '조회 중...';
        currentViewerCountEl.textContent = '-';
        viewerChangeEl.textContent = '-';
        if (viewerResultEl) viewerResultEl.innerHTML = '';
        fetchYouTubeViewerCount(videoId).then(function (result) {
            var n = result.viewerCount;
            initialViewerCount = n;
            lastViewerCount = n;
            updateViewerStats(initialViewerCount, lastViewerCount);
            if (n != null) {
                addLog('info', '시작 시청자 수: ' + n.toLocaleString() + '명');
                setViewerCountError('');
            } else {
                var errMsg = result.error || '시청자 수를 가져올 수 없습니다.';
                setViewerCountError('⚠ ' + errMsg);
                addLog('warning', errMsg + ' (라이브 URL·YOUTUBE_API_KEY 확인)');
            }
            if (!viewerPollInterval) {
                viewerPollInterval = setInterval(function () {
                    if (!isRunning) return;
                    fetchYouTubeViewerCount(videoId).then(function (res) {
                        if (res.viewerCount != null) {
                            lastViewerCount = res.viewerCount;
                            updateViewerStats(initialViewerCount, lastViewerCount, function (change) {
                                if (!hasLoggedViewerIncrease) {
                                    hasLoggedViewerIncrease = true;
                                    addLog('success', '✅ [이 방송] 시청자 수 증가 감지: 시작 ' + initialViewerCount.toLocaleString() + '명 → 현재 ' + lastViewerCount.toLocaleString() + '명 (+' + change.toLocaleString() + '명)');
                                }
                            });
                        }
                    });
                }, 15000);
            }
        });
    }

    function sendOne(index) {
        if (!isRunning) return;

        // no-cors: 요청은 전송되나 응답은 CORS로 읽을 수 없음. 외부 URL에서 실패 방지.
        fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'omit' })
            .then(function () {
                if (!isRunning) return;
                opened++;
                addLog('success', '요청 #' + (index + 1) + ' 전송됨');
                updateStats(opened, target - opened - blocked, blocked);
                scheduleNext(index);
            })
            .catch(function (err) {
                if (!isRunning) return;
                blocked++;
                addLog('warning', '요청 #' + (index + 1) + ' 실패: ' + (err && err.message ? err.message : '네트워크 오류'));
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
        timeouts.push(t); // 중지 시 clearTimeout으로 취소하기 위해 보관
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
    if (usePuppeteer) {
        fetch('/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            .then(function () { finishPuppeteer(); });
        addLog('warning', '사용자가 중지했습니다.');
        return;
    }
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

// 백엔드 능력 조회 → 모드 안내 표시
fetch('/api/capabilities')
    .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function (data) {
        usePuppeteer = data.puppeteer === true;
        if (modeNoticeEl) {
            modeNoticeEl.innerHTML = usePuppeteer
                ? '※ 모드: 실제 브라우저 (플레이어 로드) · 시청자 수에 반영될 수 있습니다.'
                : '※ 모드: 요청 전송만 · 시청자 수는 증가하지 않습니다. Vercel은 서버리스라 실제 브라우저 모드를 지원하지 않습니다. 실제 반영: 로컬 <code>npm run server</code> 또는 Railway/Render 등 서버 호스팅.';
        }
    })
    .catch(function () {
        usePuppeteer = false;
        if (modeNoticeEl) {
            modeNoticeEl.innerHTML = '※ 모드: 요청 전송만 · 시청자 수는 증가하지 않습니다. Vercel은 서버리스라 실제 브라우저(플레이어) 모드를 지원하지 않습니다. 실제 반영을 원하면 로컬에서 <code>npm run server</code> 또는 Railway/Render 등 서버 호스팅에 배포하세요.';
        }
    });

// 초기 통계
updateStats(0, 0, 0);
