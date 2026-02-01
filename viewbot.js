/**
 * 웹사이트 접속 시뮬레이션 도구 (Puppeteer 기반)
 * 주의: 이 도구는 교육 목적으로만 사용하세요. 실제 웹사이트의 서비스 약관을 확인하고 준수하세요.
 */
const puppeteer = require('puppeteer');

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

    /**
     * 랜덤 지연 시간 생성
     */
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 자연스러운 스크롤 시뮬레이션 (리소스 절약 버전)
     */
    async simulateScrolling(page) {
        const scrollCount = this.randomDelay(2, 4); // 스크롤 횟수 감소
        for (let i = 0; i < scrollCount; i++) {
            const scrollAmount = this.randomDelay(300, 600); // 스크롤 거리 감소
            await page.evaluate((amount) => {
                window.scrollBy(0, amount);
            }, scrollAmount);
            await this.sleep(this.randomDelay(1500, 2500)); // 대기 시간 단축
        }
    }

    /**
     * Sleep 유틸리티
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * YouTube 시청자 수 추출 (개선된 버전)
     */
    async extractViewerCount(page) {
        try {
            // 페이지가 완전히 로드될 때까지 대기
            await page.waitForTimeout(8000); // 더 긴 대기로 페이지 완전 로드 보장
            
            const viewerCount = await page.evaluate(() => {
                // 디버깅: 페이지 텍스트 일부 확인
                const pageText = document.body.innerText || document.body.textContent || '';
                
                // 방법 0: YouTube 라이브 스트림의 정확한 위치 찾기
                // 라이브 채팅 패널이나 시청자 수 표시 영역 찾기
                const liveChatPanel = document.querySelector('yt-live-chat-app, #chat, #chatframe');
                if (liveChatPanel) {
                    const chatText = liveChatPanel.innerText || '';
                    const viewerMatch = chatText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:명\s*)?(?:시청|viewers?|watching)/i);
                    if (viewerMatch) {
                        const num = parseInt(viewerMatch[1].replace(/,/g, ''));
                        if (num > 0 && num < 10000000) {
                            return num;
                        }
                    }
                }
                
                // 방법 1: YouTube 라이브 채팅의 시청자 수 요소 찾기 (더 정확한 선택자)
                const liveChatSelectors = [
                    'yt-live-chat-viewer-engagement-message-renderer',
                    'yt-live-chat-item-list-renderer',
                    '[class*="viewer-engagement"]',
                    '[class*="viewer-count"]',
                    'yt-formatted-string[class*="viewer"]',
                    'span[class*="viewer"]',
                    '#viewer-count',
                    '[id*="viewer-count"]'
                ];
                
                for (const selector of liveChatSelectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            const text = element.innerText || element.textContent || '';
                            // "109명 시청" 또는 "109 viewers" 패턴 찾기
                            const match = text.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:명\s*)?(?:시청|viewers?|watching)/i);
                            if (match) {
                                const num = parseInt(match[1].replace(/,/g, ''));
                                if (num >= 1 && num < 10000000) { // 합리적인 범위
                                    return num;
                                }
                            }
                        }
                    } catch (e) {}
                }
                
                // 방법 2: 페이지 전체 텍스트에서 시청자 수 찾기 (더 정확한 패턴)
                const allText = document.body.innerText || document.body.textContent || '';
                
                // 한국어 패턴: "109명 시청", "109 명 시청", "시청 109명" 등
                const koreanPatterns = [
                    /(\d{1,3}(?:,\d{3})*|\d+)\s*명\s*시청/i,
                    /시청\s*(\d{1,3}(?:,\d{3})*|\d+)\s*명/i,
                    /(\d{1,3}(?:,\d{3})*|\d+)\s*명\s*현재\s*시청/i,
                    /현재\s*(\d{1,3}(?:,\d{3})*|\d+)\s*명/i
                ];
                
                for (const pattern of koreanPatterns) {
                    const match = allText.match(pattern);
                    if (match) {
                        const num = parseInt(match[1].replace(/,/g, ''));
                        if (num > 0 && num < 10000000) {
                            return num;
                        }
                    }
                }
                
                // 영어 패턴: "109 viewers", "109 watching", "watching 109" 등
                const englishPatterns = [
                    /(\d{1,3}(?:,\d{3})*|\d+)\s*viewers?/i,
                    /(\d{1,3}(?:,\d{3})*|\d+)\s*watching/i,
                    /watching\s*(\d{1,3}(?:,\d{3})*|\d+)/i,
                    /(\d{1,3}(?:,\d{3})*|\d+)\s*people\s*watching/i
                ];
                
                for (const pattern of englishPatterns) {
                    const match = allText.match(pattern);
                    if (match) {
                        const num = parseInt(match[1].replace(/,/g, ''));
                        if (num > 0 && num < 10000000) {
                            return num;
                        }
                    }
                }
                
                // 방법 3: aria-label에서 찾기
                const ariaElements = document.querySelectorAll('[aria-label]');
                for (const elem of ariaElements) {
                    const ariaLabel = elem.getAttribute('aria-label') || '';
                    const match = ariaLabel.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:명\s*)?(?:시청|viewers?|watching)/i);
                    if (match) {
                        const num = parseInt(match[1].replace(/,/g, ''));
                        if (num > 0 && num < 10000000) {
                            return num;
                        }
                    }
                }
                
                // 방법 4: 모든 숫자 찾아서 시청자 수로 보이는 것 찾기 (개선)
                const numberMatches = allText.match(/\b(\d{1,6})\b/g);
                if (numberMatches) {
                    // 큰 숫자 중에서 시청자 수일 가능성이 높은 것 찾기
                    const candidates = numberMatches
                        .map(m => parseInt(m.replace(/,/g, '')))
                        .filter(n => n >= 1 && n < 10000000)
                        .sort((a, b) => b - a); // 큰 수부터
                    
                    // "시청", "viewer" 등의 키워드와 가까운 숫자 찾기
                    for (const num of candidates) {
                        const numStr = num.toString();
                        const index = allText.indexOf(numStr);
                        if (index !== -1) {
                            const context = allText.substring(Math.max(0, index - 30), Math.min(allText.length, index + 60));
                            // 더 정확한 패턴 매칭
                            if (/시청|viewer|watching|명|현재|current/i.test(context)) {
                                // 숫자 앞뒤로 키워드가 있는지 확인
                                const beforeContext = allText.substring(Math.max(0, index - 15), index);
                                const afterContext = allText.substring(index + numStr.length, Math.min(allText.length, index + numStr.length + 15));
                                if (/시청|viewer|watching|명/i.test(beforeContext + afterContext)) {
                                    return num;
                                }
                            }
                        }
                    }
                }
                
                return null;
            });
            
            // 디버깅: 추출된 값 로그
            if (viewerCount !== null) {
                this.emit('update', { type: 'info', message: `시청자 수 추출 성공: ${viewerCount}명` });
            } else {
                this.emit('update', { type: 'warning', message: '시청자 수를 찾을 수 없습니다. 페이지 구조를 확인하세요.' });
            }
            
            return viewerCount;
        } catch (error) {
            console.error('시청자 수 추출 오류:', error);
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
            this.emit('update', { type: 'log', message: `[인스턴스 ${instanceId}] 브라우저 시작...` });
            this.emit('stats', this.stats);
            
            browser = await puppeteer.launch({
                headless: this.headless,
                args: [
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
                    '--disable-images', // 이미지 로드 비활성화 (메모리 절약)
                    '--disable-javascript-harmony-shipping',
                    '--disable-ipc-flooding-protection',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--disable-domain-reliability',
                    '--disable-component-update',
                    '--disable-sync',
                    '--disable-translate',
                    '--disable-features=TranslateUI',
                    '--disable-features=BlinkGenPropertyTrees',
                    '--memory-pressure-off', // 메모리 압력 해제
                    '--max_old_space_size=512', // 메모리 제한
                ],
                timeout: 90000,
                protocolTimeout: 120000,
            });

            const page = await browser.newPage();
            
            // User-Agent 설정
            await page.setUserAgent(this.getRandomUserAgent());
            
            // Viewport 설정
            const viewport = this.getRandomViewport();
            await page.setViewport(viewport);
            
            // WebDriver 속성 숨기기
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });

            this.emit('update', { type: 'log', message: `[인스턴스 ${instanceId}] ${this.url} 접속 중...` });
            
            // 페이지 접속 (재시도 로직 포함, YouTube 등 복잡한 사이트 대응)
            let pageLoaded = false;
            const maxRetries = 3;
            let retryCount = 0;
            let lastError = null;
            
            while (!pageLoaded && retryCount <= maxRetries) {
                try {
                    // 네트워크 에러 처리
                    page.on('error', (error) => {
                        if (error.message.includes('ERR_SOCKET_NOT_CONNECTED')) {
                            this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 네트워크 연결 문제 감지` });
                        }
                    });
                    
                    // YouTube는 load 이벤트를 기다리는 것이 더 안정적
                    await page.goto(this.url, {
                        waitUntil: 'networkidle0', // 네트워크가 완전히 유휴 상태가 될 때까지
                        timeout: 120000, // 120초로 증가
                    }).catch(async (gotoError) => {
                        // 소켓 에러 처리
                        if (gotoError.message.includes('ERR_SOCKET_NOT_CONNECTED') || gotoError.message.includes('net::')) {
                            this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 네트워크 연결 오류, 재시도 중...` });
                            await this.sleep(this.randomDelay(3000, 6000));
                            // domcontentloaded로 재시도 (더 관대한 옵션)
                            await page.goto(this.url, {
                                waitUntil: 'domcontentloaded',
                                timeout: 90000
                            });
                        } else {
                            throw gotoError;
                        }
                    });
                    
                    // 페이지가 실제로 로드되었는지 확인
                    await page.waitForFunction(
                        () => {
                            return document.readyState === 'complete' && 
                                   document.body !== null && 
                                   document.body.innerText.length > 100; // 충분한 콘텐츠 로드 확인
                        },
                        { timeout: 15000 }
                    );
                    
                    pageLoaded = true;
                } catch (error) {
                    lastError = error;
                    retryCount++;
                    if (retryCount <= maxRetries) {
                        const errorMsg = error.message.includes('timeout') 
                            ? '타임아웃' 
                            : error.message.includes('ERR_SOCKET_NOT_CONNECTED') || error.message.includes('net::')
                            ? '네트워크 연결 오류'
                            : error.message.substring(0, 50);
                        this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 재시도 중... (${retryCount}/${maxRetries}) - ${errorMsg}` });
                        await this.sleep(this.randomDelay(5000, 10000)); // 재시도 전 더 긴 대기
                    }
                }
            }
            
            if (!pageLoaded) {
                throw lastError || new Error('페이지 로드 실패');
            }

            // 실제 페이지 로드 확인 (제목, URL 등)
            const pageTitle = await page.title().catch(() => '제목 없음');
            const currentUrl = page.url();
            
            this.emit('update', { 
                type: 'success', 
                message: `[인스턴스 ${instanceId}] 페이지 로드 완료 - 제목: ${pageTitle.substring(0, 50)}` 
            });
            
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
                                
                                // 음소거 해제 (시청자 수 집계에 중요)
                                video.muted = false;
                                video.volume = 0.3; // 낮은 볼륨으로 설정
                                
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
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-gpu',
                    '--disable-software-rasterizer'
                ],
                timeout: 60000
            });
            const page = await browser.newPage();
            
            // User-Agent 설정
            await page.setUserAgent(this.getRandomUserAgent());
            await page.setViewport(this.getRandomViewport());
            
            // 네트워크 에러 처리
            page.on('error', (error) => {
                this.emit('update', { type: 'warning', message: `페이지 에러: ${error.message}` });
            });
            
            await page.goto(this.url, { 
                waitUntil: 'networkidle0', 
                timeout: 60000 
            }).catch(async (error) => {
                // 네트워크 에러 시 재시도
                if (error.message.includes('ERR_SOCKET_NOT_CONNECTED') || error.message.includes('net::')) {
                    this.emit('update', { type: 'warning', message: '네트워크 연결 문제, 재시도 중...' });
                    await this.sleep(3000);
                    await page.goto(this.url, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: 60000 
                    });
                } else {
                    throw error;
                }
            });
            
            await this.sleep(10000); // 페이지 완전 로드 대기
            
            // 라이브 채팅이 로드될 때까지 대기
            try {
                await page.waitForSelector('yt-live-chat-app, #chat, yt-live-chat-viewer-engagement-message-renderer', { timeout: 15000 }).catch(() => {});
            } catch (e) {
                // 라이브 채팅이 없어도 계속 진행
            }
            
            const viewerCount = await this.extractViewerCount(page);
            if (viewerCount !== null && viewerCount > 0) {
                this.stats.initialViewerCount = viewerCount;
                this.stats.currentViewerCount = viewerCount;
                this.stats.viewerHistory.push({
                    time: new Date(),
                    count: viewerCount
                });
                this.emit('update', { type: 'success', message: `✅ 초기 시청자 수 확인: ${viewerCount.toLocaleString()}명` });
                return viewerCount;
            } else {
                this.emit('update', { type: 'warning', message: '⚠️ 초기 시청자 수를 확인할 수 없습니다. 라이브 스트림인지 확인하세요.' });
                return null;
            }
        } catch (error) {
            const errorMsg = error.message.includes('ERR_SOCKET_NOT_CONNECTED') || error.message.includes('net::')
                ? '네트워크 연결 오류'
                : error.message;
            this.emit('update', { type: 'warning', message: `시청자 수 확인 실패: ${errorMsg}` });
            return null;
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    // 무시
                }
            }
        }
    }

    /**
     * 시청자 수 추적 시작 (주기적 업데이트)
     */
    startViewerTracking() {
        
        // 주기적으로 시청자 수 업데이트 (15초마다 - 더 자주 체크하여 변화 추적)
        this.viewerTrackingInterval = setInterval(async () => {
            if (!this.running) {
                clearInterval(this.viewerTrackingInterval);
                return;
            }
            
            try {
                const browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-gpu',
                        '--disable-software-rasterizer'
                    ],
                    timeout: 60000
                });
                const page = await browser.newPage();
                
                // 매번 다른 User-Agent 사용
                await page.setUserAgent(this.getRandomUserAgent());
                await page.setViewport(this.getRandomViewport());
                
                await page.goto(this.url, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 60000 
                }).catch(() => {});
                
                await this.sleep(10000); // 라이브 채팅 로드 대기
                
                // 라이브 채팅이 로드될 때까지 대기
                try {
                    await page.waitForSelector('yt-live-chat-app, #chat, yt-live-chat-viewer-engagement-message-renderer', { timeout: 10000 }).catch(() => {});
                } catch (e) {}
                
                const viewerCount = await this.extractViewerCount(page);
                if (viewerCount !== null && viewerCount > 0) {
                    const previousCount = this.stats.currentViewerCount;
                    this.stats.currentViewerCount = viewerCount;
                    this.stats.viewerHistory.push({
                        time: new Date(),
                        count: viewerCount
                    });
                    
                    // 최근 100개 유지 (더 긴 추적)
                    if (this.stats.viewerHistory.length > 100) {
                        this.stats.viewerHistory.shift();
                    }
                    
                    // 변화량 로그 (더 자세한 정보)
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
                        // 초기 시청자 수와 비교
                        const change = viewerCount - this.stats.initialViewerCount;
                        const changePercent = ((change / this.stats.initialViewerCount) * 100).toFixed(1);
                        this.emit('update', { 
                            type: change > 0 ? 'success' : 'info', 
                            message: `📊 시청자 수: ${viewerCount.toLocaleString()}명 (시작 대비 ${change >= 0 ? '+' : ''}${change}, ${changePercent}%)` 
                        });
                    }
                    
                    this.emit('stats', this.stats);
                }
                
                await browser.close();
            } catch (error) {
                // 조용히 실패 (너무 많은 로그 방지)
            }
        }, 15000); // 15초마다 업데이트 (더 자주 체크)
    }

    /**
     * 봇 중지
     */
    stop() {
        this.running = false;
        if (this.viewerTrackingInterval) {
            clearInterval(this.viewerTrackingInterval);
        }
        this.emit('update', { type: 'warning', message: '봇이 중지되었습니다.' });
    }

    /**
     * 지속적으로 실행 (일정 간격으로 반복)
     */
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
