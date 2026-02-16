/**
 * Enhanced YouTube Live Stream Viewer Count Extraction
 * Updated for 2024 YouTube structure
 */

// Test function to validate extraction logic
async function testViewerCountExtraction() {
    const testCases = [
        {
            name: "Lofi Girl Live Stream",
            videoId: "jfKfPfyJRdk",
            expected: true // Should have viewer count
        },
        {
            name: "Regular Video (No Live)",
            videoId: "dQw4w9WgXcQ",
            expected: false // No viewer count
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n=== Testing: ${testCase.name} ===`);
        console.log(`Video ID: ${testCase.videoId}`);
        
        // Test API approach
        const apiResult = await testAPIApproach(testCase.videoId);
        console.log(`API Result: ${apiResult}`);
        
        // Test Puppeteer approach (simulated)
        const puppeteerResult = await simulatePuppeteerExtraction(testCase.videoId);
        console.log(`Puppeteer Result: ${puppeteerResult}`);
        
        console.log(`Expected: ${testCase.expected ? 'Should have viewer count' : 'Should not have viewer count'}`);
        console.log(`Test ${(apiResult !== null) === testCase.expected ? '✅ PASSED' : '❌ FAILED'}`);
    }
}

// Simulate Puppeteer extraction for testing
async function simulatePuppeteerExtraction(videoId) {
    // This simulates what the enhanced extractViewerCount function would do
    const mockPageContent = getMockPageContent(videoId);
    
    return extractViewerCountFromContent(mockPageContent);
}

function getMockPageContent(videoId) {
    if (videoId === "jfKfPfyJRdk") {
        // Lofi Girl live stream mock content
        return `
            <div class="ytp-chrome-top">
                <div class="ytp-title">
                    <div class="ytp-title-text">lofi hip hop radio 📚 beats to relax/study to</div>
                </div>
            </div>
            <div id="movie_player">
                <div class="ytp-chrome-bottom">
                    <div class="ytp-chrome-controls">
                        <span class="ytp-live-badge">LIVE</span>
                        <span class="ytp-viewer-count">12,822 watching now</span>
                    </div>
                </div>
            </div>
            <yt-live-chat-app>
                <yt-live-chat-header-renderer>
                    <div class="viewer-engagement-message">12,822 viewers</div>
                </yt-live-chat-header-renderer>
            </yt-live-chat-app>
        `;
    } else {
        // Regular video mock content
        return `
            <div class="ytp-chrome-top">
                <div class="ytp-title">
                    <div class="ytp-title-text">Rick Astley - Never Gonna Give You Up (Official Music Video)</div>
                </div>
            </div>
            <div id="movie_player">
                <div class="ytp-chrome-bottom">
                    <div class="ytp-chrome-controls">
                        <span class="ytp-time-duration">3:32</span>
                    </div>
                </div>
            </div>
        `;
    }
}

function extractViewerCountFromContent(content) {
    // Enhanced extraction patterns for 2024 YouTube
    const patterns = [
        // YouTube Player viewer count
        /(\d{1,3}(?:,\d{3})*)\s*watching now/i,
        /(\d{1,3}(?:,\d{3})*)\s*viewers/i,
        /(\d{1,3}(?:,\d{3})*)\s*watching/i,
        
        // Live chat viewer count
        /(\d{1,3}(?:,\d{3})*)\s*viewers/i,
        /viewer-engagement-message[^>]*>(\d{1,3}(?:,\d{3})*)/i,
        
        // Korean patterns
        /(\d{1,3}(?:,\d{3})*)\s*명\s*시청/i,
        /(\d{1,3}(?:,\d{3})*)\s*명\s*현재\s*시청/i,
        
        // General patterns
        /(\d{1,3}(?:,\d{3})*)\s*people\s*watching/i,
        /watching\s*(\d{1,3}(?:,\d{3})*)/i
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            const num = parseInt(match[1].replace(/,/g, ''));
            if (num > 0 && num < 10000000) { // Reasonable range
                return num;
            }
        }
    }
    
    return null;
}

// Test API approach
async function testAPIApproach(videoId) {
    const https = require('https');
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: `/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=AIzaSyDmgwj-qt_mig6AuhWB9xTPh6bbQEolBD4`,
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

console.log('=== Enhanced Viewer Count Extraction Logic ===');

// Enhanced extractViewerCount function for viewbot.js
const enhancedExtractViewerCount = `
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
                        const match = text.match(/(\\d{1,3}(?:,\\d{3})*)\\s*(?:watching|viewers?|명\\s*시청)/i);
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
                        const match = text.match(/(\\d{1,3}(?:,\\d{3})*)\\s*(?:viewers?|명\\s*시청|watching)/i);
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
                        /(\\d{1,3}(?:,\\d{3})*)\\s*watching now/i,
                        /(\\d{1,3}(?:,\\d{3})*)\\s*viewers/i,
                        /(\\d{1,3}(?:,\\d{3})*)\\s*명\\s*현재\\s*시청/i,
                        /현재\\s*(\\d{1,3}(?:,\\d{3})*)\\s*명/i,
                        /(\\d{1,3}(?:,\\d{3})*)\\s*people\\s*watching/i
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
`;

console.log(enhancedExtractViewerCount);

// Run the test
testViewerCountExtraction().catch(console.error);