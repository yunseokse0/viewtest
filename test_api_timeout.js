// Test API and create fixed version
const https = require('https');

async function testYouTubeAPI() {
    const videoId = 'jfKfPfyJRdk';
    const apiKey = 'AIzaSyDmgwj-qt_mig6AuhWB9xTPh6bbQEolBD4';
    
    console.log('=== Testing YouTube API ===');
    console.log(`Video ID: ${videoId}`);
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'www.googleapis.com',
            path: `/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ViewBot/1.0'
            },
            timeout: 5000 // 5 second timeout
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    console.log(`Status Code: ${res.statusCode}`);
                    console.log(`Response Length: ${data.length}`);
                    
                    if (res.statusCode === 200) {
                        const json = JSON.parse(data);
                        console.log('Response:', JSON.stringify(json, null, 2));
                        
                        if (json.items && json.items.length > 0 && json.items[0].liveStreamingDetails) {
                            const viewers = json.items[0].liveStreamingDetails.concurrentViewers;
                            console.log(`✅ Concurrent Viewers: ${viewers}`);
                            resolve(viewers);
                        } else {
                            console.log('❌ No live streaming details found');
                            resolve(null);
                        }
                    } else {
                        console.log(`❌ API Error: ${res.statusCode}`);
                        console.log('Response:', data.substring(0, 200));
                        resolve(null);
                    }
                } catch (error) {
                    console.log(`❌ JSON Parse Error: ${error.message}`);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Request Error: ${error.message}`);
            resolve(null);
        });

        req.on('timeout', () => {
            console.log('❌ Request Timeout');
            req.destroy();
            resolve(null);
        });

        req.end();
    });
}

// Test the API
testYouTubeAPI().then(result => {
    console.log(`\nFinal Result: ${result}`);
}).catch(error => {
    console.error('Test failed:', error);
});