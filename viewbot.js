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
            startTime: null
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
     * 자연스러운 스크롤 시뮬레이션
     */
    async simulateScrolling(page) {
        const scrollCount = this.randomDelay(2, 5);
        for (let i = 0; i < scrollCount; i++) {
            const scrollAmount = this.randomDelay(300, 800);
            await page.evaluate((amount) => {
                window.scrollBy(0, amount);
            }, scrollAmount);
            await this.sleep(this.randomDelay(1000, 3000));
        }
    }

    /**
     * Sleep 유틸리티
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
                ],
                timeout: 90000, // 브라우저 시작 타임아웃 증가
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
                    // domcontentloaded는 더 빠르고 안정적 (YouTube에 적합)
                    await page.goto(this.url, {
                        waitUntil: 'domcontentloaded', // DOM만 로드되면 성공으로 간주
                        timeout: 90000, // 90초로 증가 (YouTube는 로딩이 오래 걸림)
                    });
                    
                    // 페이지가 실제로 로드되었는지 확인
                    await page.waitForFunction(
                        () => document.readyState === 'complete' || document.body !== null,
                        { timeout: 10000 }
                    ).catch(() => {
                        // 무시 - 이미 DOM은 로드됨
                    });
                    
                    pageLoaded = true;
                } catch (error) {
                    lastError = error;
                    retryCount++;
                    if (retryCount <= maxRetries) {
                        this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 재시도 중... (${retryCount}/${maxRetries})` });
                        await this.sleep(this.randomDelay(3000, 8000)); // 재시도 전 더 긴 대기
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
            
            // YouTube인 경우 비디오 재생 시도
            if (this.url.includes('youtube.com') || this.url.includes('youtu.be')) {
                try {
                    // YouTube 비디오 재생 버튼 클릭 시도
                    await page.evaluate(() => {
                        const playButton = document.querySelector('.ytp-play-button, button[aria-label*="재생"], button[aria-label*="Play"]');
                        if (playButton) {
                            playButton.click();
                        }
                    }).catch(() => {
                        // 재생 버튼을 찾을 수 없어도 계속 진행
                    });
                    
                    // 비디오가 실제로 재생 중인지 확인
                    await this.sleep(3000);
                    const isPlaying = await page.evaluate(() => {
                        const video = document.querySelector('video');
                        return video && !video.paused;
                    }).catch(() => false);
                    
                    if (isPlaying) {
                        this.emit('update', { type: 'success', message: `[인스턴스 ${instanceId}] 비디오 재생 중` });
                    }
                } catch (error) {
                    this.emit('update', { type: 'warning', message: `[인스턴스 ${instanceId}] 비디오 재생 시도 실패 (정상적일 수 있음)` });
                }
            }
            
            this.stats.totalVisits++;
            this.emit('stats', this.stats);

            // 랜덤한 시간 동안 페이지에 머무름
            const stayTime = this.randomDelay(this.minDelay, this.maxDelay);
            this.emit('update', { type: 'info', message: `[인스턴스 ${instanceId}] ${Math.floor(stayTime / 1000)}초 동안 페이지에 머무름...` });

            // 스크롤 시뮬레이션 (자연스러운 사용자 행동)
            await this.simulateScrolling(page);
            
            // YouTube인 경우 추가적인 상호작용 시도
            if (this.url.includes('youtube.com') || this.url.includes('youtu.be')) {
                try {
                    // 페이지에서 마우스 움직임 시뮬레이션
                    await page.mouse.move(
                        this.randomDelay(100, 500),
                        this.randomDelay(100, 500)
                    );
                    
                    // 추가 스크롤 (YouTube는 긴 페이지)
                    for (let i = 0; i < 3; i++) {
                        await this.sleep(this.randomDelay(2000, 4000));
                        await page.evaluate(() => {
                            window.scrollBy(0, 300);
                        });
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
                    await browser.close();
                    this.emit('update', { type: 'log', message: `[인스턴스 ${instanceId}] 브라우저 종료` });
                } catch (error) {
                    // 무시
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
        
        this.emit('update', { type: 'info', message: `ViewBot 시작: ${this.url}` });
        this.emit('update', { type: 'info', message: `동시 실행 인스턴스 수: ${this.numInstances}` });
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
     * 봇 중지
     */
    stop() {
        this.running = false;
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
