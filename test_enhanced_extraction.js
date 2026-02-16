/**
 * Quick test for enhanced viewer count extraction
 */
const puppeteer = require('puppeteer');

async function testEnhancedExtraction() {
    console.log('=== Testing Enhanced Viewer Count Extraction ===');
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        // Test with Lofi Girl live stream
        const testUrl = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
        console.log(`Testing URL: ${testUrl}`);
        
        await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait a bit for the page to load completely
        await page.waitForTimeout(5000);
        
        // Test the enhanced extraction function
        const viewerCount = await page.evaluate(() => {
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
        
        console.log(`✅ Extracted viewer count: ${viewerCount}`);
        console.log(`✅ Test ${viewerCount !== null ? 'PASSED' : 'FAILED'}`);
        
        // Also test API approach
        console.log('\n=== Testing API Approach ===');
        const videoId = 'jfKfPfyJRdk';
        const apiKey = 'AIzaSyDmgwj-qt_mig6AuhWB9xTPh6bbQEolBD4';
        
        const apiViewerCount = await page.evaluate(async (videoId, apiKey) => {
            try {
                const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`);
                const data = await response.json();
                
                if (data.items && data.items.length > 0 && data.items[0].liveStreamingDetails) {
                    const viewers = data.items[0].liveStreamingDetails.concurrentViewers;
                    if (typeof viewers === 'number' && viewers > 0) {
                        return viewers;
                    }
                }
            } catch (error) {
                console.log('API Error:', error.message);
            }
            return null;
        }, videoId, apiKey);
        
        console.log(`✅ API viewer count: ${apiViewerCount}`);
        
    } catch (error) {
        console.log(`❌ Error during test: ${error.message}`);
    } finally {
        await browser.close();
    }
}

testEnhancedExtraction().catch(console.error);