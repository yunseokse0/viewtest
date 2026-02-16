// Detailed debug of getInitialViewerCount
const ViewBot = require('./viewbot');

console.log('=== Detailed ViewBot Debug ===');

const url = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
const options = {
    numInstances: 1,
    minDelay: 5000,
    maxDelay: 15000,
    headless: true,
    playMuted: true
};

console.log('Creating ViewBot instance...');
const bot = new ViewBot(url, options);

// Override getInitialViewerCount to add debugging
const originalGetInitialViewerCount = bot.getInitialViewerCount.bind(bot);
bot.getInitialViewerCount = async function() {
    console.log('[DEBUG] getInitialViewerCount started');
    
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOU_API_KEY;
    const videoId = this.extractYouTubeVideoId(this.url);
    console.log(`[DEBUG] API Key: ${apiKey ? 'Present' : 'Missing'}`);
    console.log(`[DEBUG] Video ID: ${videoId}`);
    
    if (apiKey && videoId) {
        console.log('[DEBUG] Attempting API call...');
        try {
            const count = await this.fetchYouTubeConcurrentViewers(videoId, apiKey);
            console.log(`[DEBUG] API result: ${count}`);
            if (count !== null && count > 0) {
                this.stats.initialViewerCount = count;
                this.stats.currentViewerCount = count;
                this.stats.viewerHistory.push({ time: new Date(), count });
                this.emit('update', { type: 'success', message: `✅ 초기 시청자 수 확인: ${count.toLocaleString()}명` });
                return count;
            }
        } catch (error) {
            console.log(`[DEBUG] API error: ${error.message}`);
        }
    }
    
    console.log('[DEBUG] Falling back to Puppeteer method...');
    
    // Test Puppeteer fallback
    const puppeteer = require('puppeteer');
    let browser = null;
    try {
        console.log('[DEBUG] Launching Puppeteer...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('[DEBUG] Puppeteer launched successfully');
        
        const page = await browser.newPage();
        console.log('[DEBUG] New page created');
        
        console.log('[DEBUG] Navigating to URL...');
        await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('[DEBUG] Page loaded');
        
        await page.waitForTimeout(3000);
        console.log('[DEBUG] Waited 3 seconds');
        
        console.log('[DEBUG] Attempting viewer count extraction...');
        const viewerCount = await this.extractViewerCount(page);
        console.log(`[DEBUG] Extracted viewer count: ${viewerCount}`);
        
        if (viewerCount !== null && viewerCount > 0) {
            this.stats.initialViewerCount = viewerCount;
            this.stats.currentViewerCount = viewerCount;
            this.stats.viewerHistory.push({ time: new Date(), count: viewerCount });
            this.emit('update', { type: 'success', message: `✅ 초기 시청자 수 확인: ${viewerCount.toLocaleString()}명` });
            return viewerCount;
        } else {
            this.emit('update', { type: 'warning', message: '⚠️ 초기 시청자 수를 확인할 수 없습니다. 라이브 스트림인지 확인하세요.' });
            return null;
        }
        
    } catch (error) {
        console.log(`[DEBUG] Puppeteer error: ${error.message}`);
        this.emit('update', { type: 'warning', message: `시청자 수 확인 실패: ${error.message}` });
        return null;
    } finally {
        if (browser) {
            console.log('[DEBUG] Closing browser...');
            await browser.close();
            console.log('[DEBUG] Browser closed');
        }
    }
};

console.log('\nStarting bot...');
bot.start().then(() => {
    console.log('✅ Bot started successfully');
}).catch((error) => {
    console.error('❌ Bot failed to start:', error.message);
    console.error(error.stack);
});

// Stop after 45 seconds
setTimeout(() => {
    console.log('\nStopping bot...');
    process.exit(0);
}, 45000);