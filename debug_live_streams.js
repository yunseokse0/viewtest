// Test with different live streams and debug extraction
const puppeteer = require('puppeteer');

async function testLiveStreams() {
    console.log('=== Testing Multiple Live Streams ===');
    
    const testUrls = [
        'https://www.youtube.com/watch?v=jfKfPfyJRdk', // Lofi Girl
        'https://www.youtube.com/watch?v=36YnV9STBqc', // Chillhop
        'https://www.youtube.com/watch?v=5qap5aO4i9A'  // Another popular live stream
    ];
    
    const browser = await puppeteer.launch({ headless: true });
    
    for (const url of testUrls) {
        console.log(`\n--- Testing: ${url} ---`);
        const page = await browser.newPage();
        
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForTimeout(5000); // Wait for page to load completely
            
            // Check if it's a live stream
            const isLive = await page.evaluate(() => {
                const liveIndicators = document.querySelectorAll('[class*="live"], [class*="LIVE"], [aria-label*="live"]');
                const liveBadge = document.querySelector('.badge-style-type-live-now, .live-badge, [class*="live-badge"]');
                return liveIndicators.length > 0 || !!liveBadge;
            });
            
            console.log(`Is Live: ${isLive}`);
            
            if (isLive) {
                // Try multiple extraction methods
                const methods = [
                    // Method 1: YouTube Player
                    async () => {
                        const result = await page.evaluate(() => {
                            const selectors = [
                                '.ytp-viewer-count',
                                '.ytp-live-badge + span',
                                '#movie_player [class*="viewer"]',
                                '.html5-video-player [class*="viewer"]'
                            ];
                            
                            for (const selector of selectors) {
                                const element = document.querySelector(selector);
                                if (element) {
                                    const text = element.textContent || element.innerText || '';
                                    console.log(`Player selector "${selector}": "${text}"`);
                                    const match = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:watching|viewers?|명\s*시청)/i);
                                    if (match) {
                                        return parseInt(match[1].replace(/,/g, ''));
                                    }
                                }
                            }
                            return null;
                        });
                        return result;
                    },
                    
                    // Method 2: Page text search
                    async () => {
                        const result = await page.evaluate(() => {
                            const allText = document.body.innerText || document.body.textContent || '';
                            const patterns = [
                                /(\d{1,3}(?:,\d{3})*)\s*watching now/i,
                                /(\d{1,3}(?:,\d{3})*)\s*viewers?/i,
                                /(\d{1,3}(?:,\d{3})*)\s*명\s*시청/i,
                                /현재\s*(\d{1,3}(?:,\d{3})*)\s*명/i
                            ];
                            
                            for (const pattern of patterns) {
                                const match = allText.match(pattern);
                                if (match) {
                                    console.log(`Pattern "${pattern}": found "${match[0]}"`);
                                    return parseInt(match[1].replace(/,/g, ''));
                                }
                            }
                            return null;
                        });
                        return result;
                    }
                ];
                
                for (let i = 0; i < methods.length; i++) {
                    const result = await methods[i]();
                    if (result) {
                        console.log(`✅ Method ${i + 1} success: ${result} viewers`);
                        break;
                    } else {
                        console.log(`❌ Method ${i + 1} failed`);
                    }
                }
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        } finally {
            await page.close();
        }
    }
    
    await browser.close();
}

testLiveStreams().catch(console.error);