const https = require('https');

// Test YouTube API Key
const API_KEY = 'AIzaSyDmgwj-qt_mig6AuhWB9xTPh6bbQEolBD4';
const VIDEO_ID = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up

async function testYouTubeAPI() {
    console.log('Testing YouTube API Key...');
    console.log('API Key:', API_KEY);
    console.log('Video ID:', VIDEO_ID);
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: `/youtube/v3/videos?part=liveStreamingDetails&id=${VIDEO_ID}&key=${API_KEY}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ViewBot/1.0'
            },
            timeout: 15000
        };

        console.log('Request URL:', `https://${options.hostname}${options.path}`);

        const req = https.request(options, (res) => {
            let data = '';
            console.log('Status Code:', res.statusCode);
            console.log('Headers:', res.headers);
            
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Response Data:', data);
                try {
                    const json = JSON.parse(data);
                    console.log('Parsed JSON:', JSON.stringify(json, null, 2));
                    
                    if (json.items && json.items.length > 0 && json.items[0].liveStreamingDetails) {
                        const viewers = json.items[0].liveStreamingDetails.concurrentViewers;
                        console.log('✅ SUCCESS: Concurrent viewers:', viewers);
                        resolve(viewers);
                    } else {
                        console.log('❌ No live streaming data found');
                        if (json.error) {
                            console.log('API Error:', json.error);
                        }
                        resolve(null);
                    }
                } catch (e) {
                    console.log('❌ JSON parse error:', e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.log('❌ Request error:', err.message);
            resolve(null);
        });
        
        req.on('timeout', () => {
            console.log('❌ Request timeout');
            req.destroy();
            resolve(null);
        });
        
        req.setTimeout(15000);
        req.end();
    });
}

// Test the API
async function main() {
    console.log('=== YouTube API Test ===');
    const result = await testYouTubeAPI();
    console.log('Final result:', result);
    
    // Test with a different video ID (try a live stream)
    console.log('\n=== Testing with Live Stream Video ===');
    const liveVideoId = 'jfKfPfyJRdk'; // Lofi Girl (often live)
    console.log('Live Video ID:', liveVideoId);
    
    const liveResult = await new Promise((resolve) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: `/youtube/v3/videos?part=liveStreamingDetails&id=${liveVideoId}&key=${API_KEY}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ViewBot/1.0'
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Live Stream Response:', data);
                try {
                    const json = JSON.parse(data);
                    if (json.items && json.items.length > 0 && json.items[0].liveStreamingDetails) {
                        const viewers = json.items[0].liveStreamingDetails.concurrentViewers;
                        console.log('✅ Live Stream Concurrent viewers:', viewers);
                        resolve(viewers);
                    } else {
                        console.log('❌ No live streaming data for live stream video');
                        resolve(null);
                    }
                } catch (e) {
                    console.log('❌ JSON parse error for live stream:', e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (err) => {
            console.log('❌ Live stream request error:', err.message);
            resolve(null);
        });
        
        req.on('timeout', () => {
            console.log('❌ Live stream request timeout');
            req.destroy();
            resolve(null);
        });
        
        req.setTimeout(15000);
        req.end();
    });
    
    console.log('Live stream result:', liveResult);
}

main().catch(console.error);