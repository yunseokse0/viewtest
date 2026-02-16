// Restore proper getInitialViewerCount function
const fs = require('fs');
const path = require('path');

const viewbotPath = path.join(__dirname, 'viewbot.js');
let content = fs.readFileSync(viewbotPath, 'utf8');

// Create proper function with timeout
const newFunction = `async getInitialViewerCount() {
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
                        this.emit('update', { type: 'success', message: \`✅ 초기 시청자 수 확인: \${count.toLocaleString()}명\` });
                        clearTimeout(timeout);
                        resolve(count);
                        return;
                    }
                }
            } catch (error) {
                this.emit('update', { type: 'warning', message: \`초기 시청자 수 확인 실패: \${error.message}\` });
            }
            
            clearTimeout(timeout);
            resolve(null);
        });
    }`;

// Replace the broken function
const functionStart = content.indexOf('async getInitialViewerCount() {');
const functionEnd = content.indexOf('\n    async startContinuous', functionStart);

if (functionStart !== -1 && functionEnd !== -1) {
    const before = content.substring(0, functionStart);
    const after = content.substring(functionEnd);
    const newContent = before + newFunction + after;
    fs.writeFileSync(viewbotPath, newContent);
    console.log('✅ Restored getInitialViewerCount with timeout protection');
} else {
    console.log('❌ Could not find function boundaries');
}