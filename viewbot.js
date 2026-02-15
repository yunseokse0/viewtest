/**
 * 웹사이트 접속 시뮬레이션 도구 (Puppeteer 기반)
 * 주의: 이 도구는 교육 목적으로만 사용하세요. 실제 웹사이트의 서비스 약관을 확인하고 준수하세요.
 */
const puppeteer = require('puppeteer');
const https = require('https');

const EventEmitter = require('events');

class ViewBot extends EventEmitter {
    constructor(url, options = {}) {
        super();
        this.url = url;
        this.numInstances = options.numInstances || 5;
        this.headless = options.headless !== false;
        this.minDelay = options.minDelay || 5000; // 밀리초
        this.maxDelay = options.maxDelay || 15000; // 밀리초
        this.running = false;
        this.playMuted = options.playMuted !== false;
        this.mobileEmulation = options.mobileEmulation !== undefined ? options.mobileEmulation : (process.env.MOBILE_EMULATION === 'true');
        this.proxies = [];
        if (process.env.PROXY_LIST) {
            this.proxies = process.env.PROXY_LIST.split(',').map(s => s.trim()).filter(Boolean);
        }
        this.proxyBlacklist = new Set();
        this.proxyStats = {};
        this.stats = {
            totalVisits: 0,
            activeSessions: 0,
            completedSessions: 0,
            failedSessions: 0,
            startTime: null,
            initialViewerCount: null,
            currentViewerCount: null,
            viewerHistory: [] // 시청자 수 히스토리
        };
    }

    getProxyForInstance(instanceId) {
        if (!this.proxies || this.proxies.length === 0) return null;
        const idx = (instanceId - 1) % this.proxies.length;
        return this.proxies[idx];
    }

    parseProxyAuth(proxy) {
        try {
            const u = new URL(proxy.includes('://') ? proxy : `http://${proxy}`);
            const server = `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}`;
            const username = u.username || null;
            const password = u.password || null;
            return { server, username, password };
        } catch (_) {
            return { server: proxy, username: null, password: null };
        }
    }

    isSupportedProxy(proxy) {
        try {
            const u = new URL(proxy.includes('://') ? proxy : `http://${proxy}`);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (_) {
            return true;
        }
    }

    getHealthyProxy(instanceId) {
        if (!this.proxies || this.proxies.length === 0) return null;
        const n = this.proxies.length;
        for (let k = 0; k < n; k++) {
            const idx = (instanceId - 1 + k) % n;
            const candidate = this.proxies[idx];
            if (!this.proxyBlacklist.has(candidate)) return candidate;
        }
        this.proxyBlacklist.clear();
        return this.getProxyForInstance(instanceId);
    }

    markProxyResult(proxy, ok, errMsg = '') {
        if (!proxy) return;
        const s = this.proxyStats[proxy] || { success: 0, fail: 0, lastError: '' };
        const threshold = parseInt(process.env.PROXY_FAIL_THRESHOLD || '2');
        if (ok) {
            s.success += 1;
            s.lastError = '';
            this.proxyBlacklist.delete(proxy);
        } else {
            s.fail += 1;
            s.lastError = errMsg || 'error';
            if (s.fail >= threshold) this.proxyBlacklist.add(proxy);
        }
        this.proxyStats[proxy] = s;
        this.emit('update', { type: ok ? 'info' : 'warning', message: `프록시 상태: ${proxy} ${ok ? '성공' : '실패'} (${s.success}/${s.fail})` });
    }

    setProxies(list) {
        const arr = Array.isArray(list) ? list : [];
        this.proxies = arr.map(s => String(s).trim()).filter(Boolean);
        this.proxyBlacklist.clear();
        this.proxyStats = {};
        this.emit('update', { type: 'info', message: `프록시 목록 업데이트: ${this.proxies.length}개` });
    }

    extractYouTubeVideoId(url) {
        try {
            const u = new URL(url);
            if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
                if (u.searchParams.has('v')) return u.searchParams.get('v');
                if (u.pathname.startsWith('/watch/')) return u.pathname.split('/')[2];
                if (u.pathname.startsWith('/v/')) return u.pathname.split('/')[2];
                if (u.hostname.includes('youtu.be')) return u.pathname.substring(1);
            }
        } catch (_) {}
        return null;
    }

    async fetchYouTubeConcurrentViewers(videoId, apiKey) {
        return new Promise((resolve) => {
            const options = {
                hostname: 'www.googleapis.com',
                path: `/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'ViewBot/1.0'
                },
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.items && json.items.length > 0 && json.items[0].liveStreamingDetails) {
                            const viewers = json.items[0].liveStreamingDetails.concurrentViewers;
                            if (typeof viewers === 'number' && viewers > 0) {
                                resolve(viewers);
                                return;
                            }
                        }
                    } catch (_) {}
                    resolve(null);
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
            req.setTimeout(10000);
            req.end();
        });
    }

    async getPublicIP(page) {
        try {
            await page.goto('https://api.ipify.org?format=json', { 
                waitUntil: 'domcontentloaded', 
                timeout: 10000 
            });
            const ipData = await page.evaluate(() => {
                try {
                    return JSON.parse(document.body.innerText);
                } catch (_) {
                    return { ip: 'unknown' };
                }
            });
            return ipData.ip || 'unknown';
        } catch (_) {
            return 'unknown';
        }
    }

    async extractViewerCount(page) {
        try {
            return await page.evaluate(() => {
                // Enhanced 2024 YouTube live stream viewer count extraction
                
                // Method 1: YouTube Player viewer count (most reliable)
                const playerSelectors = [
                    '.ytp-viewer-count',
                    '.ytp-live-badge + span',
                    '#movie_player [class*="viewer"]',
                    '#movie_player [class*="watching"]',
                    '.html5-video-player [class*="viewer"]'
                ];
                
                for (const selector of playerSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || element.innerText || '';
                        const match = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:watching|viewers?|명\s*시청)/i);
                        if (match) {
                            const num = parseInt(match[1].replace(/,/g, ''));
                            if (num > 0 && num < 10000000) {
                                return num;
                            }
                        }
                    }
                }
                
                // Method 2: Live chat viewer count
                const liveChatSelectors = [
                    'yt-live-chat-header-renderer',
                    'yt-live-chat-viewer-engagement-message-renderer',
                    '[class*="viewer-engagement"]',
                    '[class*="viewer-count"]',
                    'yt-formatted-string[class*="viewer"]'
                ];
                
                for (const selector of liveChatSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const text = element.textContent || element.innerText || '';
                        const match = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:viewers?|명\s*시청|watching)/i);
                        if (match) {
                            const num = parseInt(match[1].replace(/,/g, ''));
                            if (num > 0 && num < 10000000) {
                                return num;
                            }
                        }
                    }
                }
                
                // Method 3: Check for LIVE indicator first, then viewer count
                const liveIndicators = document.querySelectorAll('[class*="live"], [class*="LIVE"], yt-live-chat-app');
                if (liveIndicators.length > 0) {
                    // If it's a live stream, be more aggressive in finding viewer count
                    const allText = document.body.innerText || document.body.textContent || '';
                    
                    // Enhanced patterns for live streams
                    const livePatterns = [
                        /(\d{1,3}(?:,\d{3})*)\s*watching now/i,
                        /(\d{1,3}(?:,\d{3})*)\s*viewers/i,
                        /(\d{1,3}(?:,\d{3})*)\s*명\s*현재\s*시청/i,
                        /현재\s*(\d{1,3}(?:,\d{3})*)\s*명/i,
                        /(\d{1,3}(?:,\d{3})*)\s*people\s*watching/i
                    ];
                    
                    for (const pattern of livePatterns) {
                        const match = allText.match(pattern);
                        if (match) {
                            const num = parseInt(match[1].replace(/,/g, ''));
                            if (num > 0 && num < 10000000) {
                                return num;
                            }
                        }
                    }
                }
                
                return null;
            });
        } catch (error) {
            this.emit('update', { type: 'warning', message: '시청자 수 추출 오류: ' + error.message });
            return null;
        }
    }

    /**
     * 단일 브라우저 인스턴스로 페이지 방문
     */
    async visitPage(instanceId) {
        let browser = null;
        try {
            this.stats.activeSessions++;
            this.emit('stats', this.stats);

            // 프록시 선택 (순환식)
            const proxy = this.getHealthyProxy(instanceId);
            const proxyConf = proxy ? this.parseProxyAuth(proxy) : null;

            this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] 시작 (프록시: ${proxyConf ? proxyConf.server : '직접 연결'})` });

            // 브라우저 시작
            const baseLaunchArgs = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-domain-reliability',
                '--disable-component-update',
                '--disable-sync',
                '--disable-translate',
                '--disable-features=TranslateUI',
                '--disable-features=BlinkGenPropertyTrees',
                '--memory-pressure-off',
                '--max_old_space_size=512'
            ];

            // 페이지 이동
            const effectiveUrl = this.getEffectiveUrl();
            this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] 페이지 로드 중: ${effectiveUrl}` });

            let pageLoaded = false;
            let lastError = null;
            let page = null;
            let activeProxy = proxy;
            let activeProxyConf = proxyConf;
            const maxRetries = 3;

            for (let retryCount = 0; retryCount < maxRetries && !pageLoaded; retryCount++) {
                try {
                    if (browser) {
                        try { await browser.close(); } catch (_) {}
                        browser = null;
                    }

                    const launchArgs = activeProxyConf
                        ? [...baseLaunchArgs, `--proxy-server=${activeProxyConf.server}`]
                        : baseLaunchArgs.slice();

                    browser = await puppeteer.launch({
                        headless: this.headless,
                        args: launchArgs,
                        timeout: 90000,
                        protocolTimeout: 120000,
                    });

                    page = await browser.newPage();

                    if (activeProxyConf && activeProxyConf.username) {
                        await page.authenticate({ username: activeProxyConf.username, password: activeProxyConf.password || '' }).catch(() => {});
                    }

                    await page.setUserAgent(this.getUserAgent());
                    await page.setViewport(this.getViewport());

                    const externalIP = await this.getPublicIP(page);
                    this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] 외부 IP: ${externalIP}` });

                    // 페이지 로드 재시도
                    await page.goto(effectiveUrl, { 
                        waitUntil: 'networkidle2', 
                        timeout: 60000 
                    });

                    // 페이지가 실제로 로드되었는지 확인
                    await page.waitForFunction(() => {
                        return document.readyState === 'complete' && 
                               document.body && 
                               document.body.innerText.length > 100;
                    }, { timeout: 15000 }).catch(() => {
                        throw new Error('페이지 콘텐츠 로드 시간 초과');
                    });

                    pageLoaded = true;

                } catch (error) {
                    lastError = error;
                    if (retryCount < maxRetries - 1) {
                        this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 재시도 중... (${retryCount + 1}/${maxRetries}) - ${error.message}` });
                        await this.sleep(this.randomDelay(5000, 10000)); // 재시도 전 더 긴 대기
                        try { if (browser) await browser.close(); } catch (_) {}
                        browser = null;
                        
                        // 프록시 교체 시도
                        const nextProxy = this.getHealthyProxy(instanceId + retryCount + 1);
                        if (nextProxy && nextProxy !== activeProxy) {
                            activeProxy = nextProxy;
                            activeProxyConf = this.parseProxyAuth(nextProxy);
                            this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] 프록시 교체: ${activeProxyConf.server}` });
                        }
                    }
                }
            }
            
            if (!pageLoaded) {
                if (activeProxy) this.markProxyResult(activeProxy, false, lastError ? lastError.message : '');
                throw lastError || new Error('페이지 로드 실패');
            }

            // 실제 페이지 로드 확인 (제목, URL 등)
            const pageTitle = await page.title().catch(() => '제목 없음');
            const currentUrl = page.url();
            
            this.emit('update', { 
                type: 'success', 
                message: `[인스턴스 ${instanceId}] 페이지 로드 완료 - 제목: ${pageTitle.substring(0, 50)}` 
            });
            if (activeProxy) this.markProxyResult(activeProxy, true);
            
            // YouTube인 경우 고급 시청 패턴 적용
            if (this.url.includes('youtube.com') || this.url.includes('youtu.be')) {
                try {
                    // 1. 비디오 재생 버튼 클릭
                    await page.evaluate(() => {
                        const playButton = document.querySelector('.ytp-play-button, button[aria-label*="재생"], button[aria-label*="Play"], .ytp-large-play-button');
                        if (playButton) {
                            playButton.click();
                        }
                    }).catch(() => {});
                    
                    // 2. 비디오 요소 찾기 및 재생 강제
                    await this.sleep(3000);
                    
                    // 비디오 재생 강제 시도
                    const videoStarted = await page.evaluate(async () => {
                        const video = document.querySelector('video');
                        if (video) {
                            try {
                                // 재생 시도
                                if (video.paused) {
                                    await video.play();
                                }
                                
                                // 재생 속도 정상화 (1.0x)
                                if (video.playbackRate !== 1.0) {
                                    video.playbackRate = 1.0;
                                }
                                
                                if (typeof window.__playMuted === 'boolean') {
                                    video.muted = window.__playMuted;
                                    video.volume = window.__playMuted ? 0.0 : 0.3;
                                } else {
                                    video.muted = true;
                                    if (!this.playMuted) {
                                        video.muted = false;
                                        video.volume = 0.3;
                                    } else {
                                        video.volume = 0.0;
                                    }
                                }
                                
                                return !video.paused;
                            } catch (e) {
                                return false;
                            }
                        }
                        return false;
                    }).catch(() => false);
                    
                    if (!videoStarted) {
                        // 재생 버튼 다시 클릭 시도
                        await page.evaluate(() => {
                            const playButton = document.querySelector('.ytp-play-button, .ytp-large-play-button');
                            if (playButton) {
                                playButton.click();
                            }
                        });
                        await this.sleep(2000);
                    }
                    
                    // 3. 비디오가 실제로 재생 중인지 확인 (주기적으로)
                    let isPlaying = false;
                    for (let checkCount = 0; checkCount < 5; checkCount++) {
                        isPlaying = await page.evaluate(() => {
                            const video = document.querySelector('video');
                            return video && !video.paused && !video.ended && video.readyState >= 2;
                        }).catch(() => false);
                        
                        if (isPlaying) break;
                        await this.sleep(2000);
                    }
                    
                    if (isPlaying) {
                        this.emit('update', { type: 'success', message: `[인스턴스 ${instanceId}] 비디오 재생 중 - 최소 30초 이상 시청` });
                        
                        // 4. 최소 시청 시간 확보 (30초 이상 - YouTube 시청자 수 집계 기준)
                        const minWatchTime = 35000; // 35초 (여유 있게)
                        const maxWatchTime = 60000; // 최대 60초
                        const watchTime = this.randomDelay(minWatchTime, maxWatchTime);
                        
                        this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] ${Math.floor(watchTime / 1000)}초 동안 시청 중...` });
                        
                        // 5. 자연스러운 시청 행동 시뮬레이션 + 재생 상태 주기적 확인
                        let elapsed = 0;
                        const checkInterval = 5000; // 5초마다 재생 상태 확인
                        const interactionInterval = 10000; // 10초마다 상호작용
                        
                        while (elapsed < watchTime && this.running) {
                            // 주기적으로 재생 상태 확인
                            if (elapsed % checkInterval < 1000) {
                                const stillPlaying = await page.evaluate(() => {
                                    const video = document.querySelector('video');
                                    if (video && video.paused) {
                                        video.play().catch(() => {});
                                    }
                                    return video && !video.paused && !video.ended;
                                }).catch(() => false);
                                
                                if (!stillPlaying) {
                                    this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 비디오 재생 중단 감지, 재시작 시도...` });
                                    await page.evaluate(() => {
                                        const video = document.querySelector('video');
                                        if (video) {
                                            video.play().catch(() => {});
                                        }
                                    });
                                }
                            }
                            
                            // 주기적으로 마우스 움직임 (자연스러운 행동)
                            if (elapsed % interactionInterval < 2000) {
                                await page.mouse.move(
                                    this.randomDelay(100, 500),
                                    this.randomDelay(100, 500)
                                ).catch(() => {});
                            }
                            
                            // 가끔 스크롤
                            if (elapsed % (interactionInterval * 1.5) < 2000) {
                                await page.evaluate(() => {
                                    window.scrollBy(0, this.randomDelay(100, 300));
                                }).catch(() => {});
                            }
                            
                            await this.sleep(2000);
                            elapsed += 2000;
                        }
                        
                        // 최소 시청 시간 완료 확인
                        if (elapsed >= minWatchTime) {
                            this.emit('update', { type: 'success', message: `[인스턴스 ${instanceId}] 최소 시청 시간 완료 (${Math.floor(elapsed / 1000)}초)` });
                        }
                    } else {
                        this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 비디오 재생 실패 - 시청자 수 집계에 포함되지 않을 수 있음` });
                    }
                } catch (error) {
                    this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 비디오 재생 시도 실패` });
                }
            }
            
            this.stats.totalVisits++;
            this.emit('stats', this.stats);

            // 랜덤한 시간 동안 페이지에 머무름
            const stayTime = this.randomDelay(this.minDelay, this.maxDelay);
            this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] ${Math.floor(stayTime / 1000)}초 동안 페이지에 머무름...` });

            // 스크롤 시뮬레이션 (자연스러운 사용자 행동) - 리소스 절약을 위해 간소화
            if (this.numInstances <= 50) {
                // 인스턴스가 적을 때만 상세한 스크롤 시뮬레이션
                await this.simulateScrolling(page);
            } else {
                // 대량 실행 시 간단한 스크롤만
                await page.evaluate(() => {
                    window.scrollBy(0, 300);
                });
                await this.sleep(1000);
            }
            
            // YouTube인 경우 추가적인 자연스러운 상호작용
            if (this.url.includes('youtube.com') || this.url.includes('youtu.be')) {
                try {
                    // 댓글 섹션까지 스크롤 (자연스러운 행동)
                    await this.sleep(this.randomDelay(2000, 4000));
                    await page.evaluate(() => {
                        const commentsSection = document.querySelector('#comments, ytd-comments');
                        if (commentsSection) {
                            commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    });
                    
                    // 추가 마우스 움직임
                    for (let i = 0; i < 2; i++) {
                        await this.sleep(this.randomDelay(3000, 6000));
                        await page.mouse.move(
                            this.randomDelay(200, 800),
                            this.randomDelay(200, 600)
                        );
                    }
                } catch (error) {
                    // 무시
                }
            }

            // 남은 시간 대기
            const remainingTime = stayTime - (this.randomDelay(2000, 8000));
            if (remainingTime > 0) {
                await this.sleep(remainingTime);
            }

            this.emit('update', { type: 'success', message: `[인스턴스 ${instanceId}] 세션 종료` });
            this.stats.completedSessions++;
            this.stats.activeSessions--;
            this.emit('stats', this.stats);

        } catch (error) {
            const errorMsg = error.message.includes('timeout') 
                ? `타임아웃 (페이지 로드 시간 초과)` 
                : error.message;
            this.emit('update', { type: 'error', message: `[인스턴스 ${instanceId}] 오류: ${errorMsg}` });
            this.stats.failedSessions++;
            this.stats.activeSessions--;
            this.emit('stats', this.stats);
        } finally {
            if (browser) {
                try {
                    // 모든 페이지 닫기
                    const pages = await browser.pages();
                    await Promise.all(pages.map(p => p.close().catch(() => {})));
                    
                    // 브라우저 종료
                    await browser.close();
                    
                    // 메모리 정리 대기
                    await this.sleep(100);
                    
                    this.emit('update', { type: 'log', message: `[인스턴스 ${instanceId}] 브라우저 종료` });
                } catch (error) {
                    // 강제 종료 시도
                    try {
                        await browser.close();
                    } catch (e) {
                        // 무시
                    }
                }
            }
        }
    }

    /**
     * 봇 시작
     */
    async start() {
        if (this.running) {
            this.emit('update', { type: 'warning', message: '이미 실행 중입니다.' });
            return;
        }

        this.running = true;
        this.stats.startTime = new Date();
        this.stats.totalVisits = 0;
        this.stats.activeSessions = 0;
        this.stats.completedSessions = 0;
        this.stats.failedSessions = 0;
        this.stats.initialViewerCount = null;
        this.stats.currentViewerCount = null;
        this.stats.viewerHistory = [];
        
        this.emit('update', { type: 'info', message: `ViewBot 시작: ${this.url}` });
        this.emit('update', { type: 'info', message: `동시 실행 인스턴스 수: ${this.numInstances}` });
        if (this.proxies.length) {
            await this.precheckProxies();
            if (this.proxies.length === 0) {
                if (process.env.ALLOW_DIRECT_IF_NO_PROXY === 'true') {
                    this.emit('update', { type: 'warning', message: '사용 가능 프록시가 없어 프록시 없이 직접 연결합니다.' });
                } else {
                    this.emit('update', { type: 'error', message: '사용 가능 프록시가 없습니다. 프록시 목록을 업데이트하세요.' });
                    this.running = false;
                    return;
                }
            }
        }
        
        // YouTube인 경우 먼저 초기 시청자 수 확인 (작업 시작 전)
        if (this.url.includes('youtube.com') || this.url.includes('youtu.be')) {
            this.emit('update', { type: 'info', message: '초기 시청자 수 확인 중...' });
            await this.getInitialViewerCount(); // 먼저 초기 시청자 수 확인 완료 대기
            this.emit('stats', this.stats);
            
            // 초기 시청자 수 확인 후 추적 시작
            this.startViewerTracking();
        }
        
        this.emit('stats', this.stats);

        // 배치 처리: 한번에 너무 많은 인스턴스를 실행하지 않도록 제한
        const batchSize = Math.min(50, this.numInstances); // 최대 50개씩 배치 처리
        const promises = [];
        
        for (let i = 0; i < this.numInstances; i++) {
            const promise = (async () => {
                // 인스턴스 간 시작 시간 간격 (배치 내에서도 분산)
                const delay = this.randomDelay(500, 2000) + (Math.floor(i / batchSize) * 1000);
                await this.sleep(delay);
                await this.visitPage(i + 1);
            })();
            promises.push(promise);
            
            // 배치 크기만큼 실행 후 잠시 대기 (시스템 부하 분산)
            if ((i + 1) % batchSize === 0 && i < this.numInstances - 1) {
                await this.sleep(2000); // 배치 간 대기
            }
        }

        await Promise.all(promises);
        this.running = false;
        this.emit('update', { type: 'success', message: '모든 세션이 완료되었습니다.' });
        this.emit('complete');
    }

    /**
     * 초기 시청자 수 확인 (작업 시작 전)
     */
    
    async getInitialViewerCount() {
        // Quick timeout to prevent hanging
        return new Promise(async (resolve) => {
            const timeout = setTimeout(() => {
                this.emit('update', { type: 'warning', message: '초기 시청자 수 확인 시간 초과, 건너뜁니다...' });
                resolve(null);
            }, 8000);
            
            try {
                const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOU_API_KEY;
                const videoId = this.extractYouTubeVideoId(this.url);
                if (apiKey && videoId) {
                    const count = await this.fetchYouTubeConcurrentViewers(videoId, apiKey);
                    if (count !== null && count > 0) {
                        this.stats.initialViewerCount = count;
                        this.stats.currentViewerCount = count;
                        this.stats.viewerHistory.push({ time: new Date(), count });
                        this.emit('update', { type: 'success', message: `✅ 초기 시청자 수 확인: ${count.toLocaleString()}명` });
                        clearTimeout(timeout);
                        resolve(count);
                        return;
                    }
                }
            } catch (error) {
                this.emit('update', { type: 'warning', message: `초기 시청자 수 확인 실패: ${error.message}` });
            }
            
            clearTimeout(timeout);
            resolve(null);
        });
    }
    /**
     * 시청자 수 추적 시작
     */
    startViewerTracking() {
        if (this.viewerTrackingInterval) {
            clearInterval(this.viewerTrackingInterval);
        }
        
        // 30초마다 시청자 수 업데이트
        this.viewerTrackingInterval = setInterval(async () => {
            if (!this.running) {
                clearInterval(this.viewerTrackingInterval);
                return;
            }
            
            const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOU_API_KEY;
            const videoId = this.extractYouTubeVideoId(this.url);
            if (apiKey && videoId) {
                try {
                    const viewerCount = await this.fetchYouTubeConcurrentViewers(videoId, apiKey);
                    if (viewerCount !== null && viewerCount > 0) {
                        const previousCount = this.stats.currentViewerCount;
                        this.stats.currentViewerCount = viewerCount;
                        this.stats.viewerHistory.push({ time: new Date(), count: viewerCount });
                        if (this.stats.viewerHistory.length > 100) {
                            this.stats.viewerHistory.shift();
                        }
                        if (previousCount !== null && previousCount > 0) {
                            const change = viewerCount - previousCount;
                            const changePercent = ((change / previousCount) * 100).toFixed(1);
                            if (Math.abs(change) > 0) {
                                this.emit('update', { 
                                    type: change > 0 ? 'success' : 'info', 
                                    message: `📊 시청자 수: ${viewerCount.toLocaleString()}명 (${change >= 0 ? '+' : ''}${change}, ${changePercent}%)` 
                                });
                            }
                        } else if (previousCount === null && this.stats.initialViewerCount !== null) {
                            const change = viewerCount - this.stats.initialViewerCount;
                            const changePercent = ((change / this.stats.initialViewerCount) * 100).toFixed(1);
                            this.emit('update', { 
                                type: change > 0 ? 'success' : 'info', 
                                message: `📊 시청자 수: ${viewerCount.toLocaleString()}명 (초기 대비 ${change >= 0 ? '+' : ''}${change}, ${changePercent}%)` 
                            });
                        } else {
                            this.emit('update', { 
                                type: 'info', 
                                message: `📊 현재 시청자 수: ${viewerCount.toLocaleString()}명` 
                            });
                        }
                        this.emit('stats', this.stats);
                    }
                } catch (error) {
                    // API 호출 실패 시 무시
                }
            }
        }, 30000); // 30초마다 업데이트
    }

    async startContinuous(interval = 30000) {
        console.log(`지속 모드 시작 (간격: ${Math.floor(interval / 1000)}초)`);
        
        const runLoop = async () => {
            try {
                while (true) {
                    await this.start();
                    console.log(`${Math.floor(interval / 1000)}초 후 다음 배치 시작...`);
                    await this.sleep(interval);
                }
            } catch (error) {
                if (error.message !== 'SIGINT') {
                    console.error('오류:', error);
                }
            }
        };

        // Ctrl+C 처리
        process.on('SIGINT', () => {
            console.log('\n사용자에 의해 중단되었습니다.');
            this.running = false;
            process.exit(0);
        });

        await runLoop();
    }

    /**
     * 자연스러운 스크롤 시뮬레이션 (리소스 절약 버전)
     */
    async simulateScrolling(page) {
        try {
            const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
            const viewportHeight = await page.evaluate(() => window.innerHeight);
            
            if (scrollHeight <= viewportHeight) return;
            
            // 랜덤한 스크롤 패턴
            const scrollSteps = this.randomDelay(3, 8);
            const maxScroll = Math.min(scrollHeight - viewportHeight, scrollHeight * 0.7);
            
            for (let i = 0; i < scrollSteps; i++) {
                const scrollPosition = Math.floor((maxScroll / scrollSteps) * i);
                await page.evaluate((pos) => {
                    window.scrollTo({
                        top: pos,
                        behavior: 'smooth'
                    });
                }, scrollPosition);
                
                // 스크롤 간 대기 시간 (자연스러운 속도)
                await this.sleep(this.randomDelay(1500, 3000));
                
                // 가끔 위로 스크롤 (사용자 행동 시뮬레이션)
                if (Math.random() < 0.3 && i > 0) {
                    const backScroll = this.randomDelay(100, 300);
                    await page.evaluate((pos) => {
                        window.scrollBy({
                            top: -pos,
                            behavior: 'smooth'
                        });
                    }, backScroll);
                    await this.sleep(this.randomDelay(1000, 2000));
                }
            }
            
            // 마지막으로 천천히 위로 스크롤
            await page.evaluate(() => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
            await this.sleep(this.randomDelay(2000, 4000));
            
        } catch (error) {
            // 스크롤 실패 시 무시
        }
    }

    /**
     * 랜덤 지연
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getUserAgent() {
        return this.mobileEmulation ? this.getRandomMobileUserAgent() : this.getRandomUserAgent();
    }
    /**
     * 랜덤 창 크기 생성
     */
    getRandomViewport() {
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 },
            { width: 1440, height: 900 },
        ];
        return viewports[Math.floor(Math.random() * viewports.length)];
    }

    getRandomMobileViewport() {
        const vps = [
            { width: 390, height: 844, isMobile: true },
            { width: 360, height: 800, isMobile: true },
            { width: 412, height: 915, isMobile: true }
        ];
        return vps[Math.floor(Math.random() * vps.length)];
    }

    getViewport() {
        return this.mobileEmulation ? this.getRandomMobileViewport() : this.getRandomViewport();
    }
    getEffectiveUrl() {
        try {
            const u = new URL(this.url);
            if ((this.mobileEmulation) && (u.hostname.includes('youtube.com'))) {
                if (u.pathname.includes('/watch') && u.searchParams.has('v')) {
                    return `https://m.youtube.com/watch?v=${u.searchParams.get('v')}`;
                }
            }
        } catch (_) {}
        return this.url;
    }
    /**
     * 랜덤 지연 시간 생성
     */
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async checkProxy(proxy) {
        const conf = this.parseProxyAuth(proxy);
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    `--proxy-server=${conf.server}`
                ],
                timeout: 45000
            });
            const page = await browser.newPage();
            if (conf.username) {
                await page.authenticate({ username: conf.username, password: conf.password || '' }).catch(() => {});
            }
            await page.goto('https://www.youtube.com/generate_204', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            await browser.close();
            this.markProxyResult(proxy, true);
            return true;
        } catch (e) {
            try { if (browser) await browser.close(); } catch (_) {}
            this.markProxyResult(proxy, false, e.message);
            return false;
        }
    }

    async precheckProxies() {
        if (!this.proxies || this.proxies.length === 0) return;
        const before = this.proxies.length;
        this.proxies = this.proxies.filter(p => this.isSupportedProxy(p));
        const removedSocks = before - this.proxies.length;
        if (removedSocks > 0) {
            this.emit('update', { type: 'warning', message: `SOCKS 프록시 ${removedSocks}개 제외 (HTTP/HTTPS 권장)` });
        }
        this.emit('update', { type: 'info', message: `프록시 사전 점검 시작 (${this.proxies.length}개)` });
        const healthy = [];
        for (const p of this.proxies) {
            const ok = await this.checkProxy(p);
            if (ok) healthy.push(p);
        }
        if (healthy.length === 0) {
            this.emit('update', { type: 'warning', message: '모든 프록시 점검 실패. 기존 목록을 그대로 사용합니다.' });
            return;
        }
        this.proxies = healthy;
        this.emit('update', { type: 'success', message: `프록시 사전 점검 완료. 사용 가능: ${healthy.length}개` });
    }
    
    purgeFailingProxies(threshold = 2) {
        if (!this.proxies || this.proxies.length === 0) return { removed: 0, remaining: 0 };
        const keep = [];
        let removed = 0;
        for (const p of this.proxies) {
            const s = this.proxyStats[p] || { success: 0, fail: 0 };
            if (s.fail >= threshold && s.success === 0) {
                removed++;
                this.proxyBlacklist.add(p);
            } else {
                keep.push(p);
            }
        }
        this.proxies = keep;
        return { removed, remaining: keep.length };
    }
    
    getProxyStatsSnapshot() {
        return { stats: this.proxyStats, blacklist: Array.from(this.proxyBlacklist || []), list: this.proxies.slice() };
    }

    /**
     * 랜덤 User-Agent 생성
     */
    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    getRandomMobileUserAgent() {
        const uas = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
        ];
        return uas[Math.floor(Math.random() * uas.length)];
    }
}

// CLI 인터페이스
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
사용법:
  node viewbot.js <URL> [옵션]

옵션:
  --instances <숫자>     동시 실행 인스턴스 수 (기본값: 5)
  --no-headless          헤드리스 모드 비활성화
  --min-delay <밀리초>   최소 대기 시간 (기본값: 5000)
  --max-delay <밀리초>   최대 대기 시간 (기본값: 15000)
  --continuous           지속 모드 (반복 실행)
  --interval <밀리초>    지속 모드 간격 (기본값: 30000)

예제:
  node viewbot.js https://example.com
  node viewbot.js https://example.com --instances 10 --continuous
        `);
        process.exit(0);
    }

    const url = args[0];
    const options = {
        numInstances: 5,
        headless: true,
        minDelay: 5000,
        maxDelay: 15000,
    };

    let continuous = false;
    let interval = 30000;

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--instances':
                options.numInstances = parseInt(args[++i]);
                break;
            case '--no-headless':
                options.headless = false;
                break;
            case '--min-delay':
                options.minDelay = parseInt(args[++i]);
                break;
            case '--max-delay':
                options.maxDelay = parseInt(args[++i]);
                break;
            case '--continuous':
                continuous = true;
                break;
            case '--interval':
                interval = parseInt(args[++i]);
                break;
        }
    }

    const bot = new ViewBot(url, options);

    if (continuous) {
        bot.startContinuous(interval);
    } else {
        bot.start().catch(console.error);
    }
}

module.exports = ViewBot;
