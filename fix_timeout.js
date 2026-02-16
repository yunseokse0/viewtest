// Quick fix for getInitialViewerCount timeout
const fs = require('fs');
const path = require('path');

const viewbotPath = path.join(__dirname, 'viewbot.js');
let content = fs.readFileSync(viewbotPath, 'utf8');

// Add timeout wrapper to getInitialViewerCount
const oldFunction = `async getInitialViewerCount() {
        const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOU_API_KEY;
        const videoId = this.extractYouTubeVideoId(this.url);
        if (apiKey && videoId) {
            const count = await this.fetchYouTubeConcurrentViewers(videoId, apiKey);
            if (count !== null && count > 0) {
                this.stats.initialViewerCount = count;
                this.stats.currentViewerCount = count;
                this.stats.viewerHistory.push({ time: new Date(), count });
                this.emit('update', { type: 'success', message: \`✅ 초기 시청자 수 확인: \${count.toLocaleString()}명\` });
                return count;
            }
        }`;

const newFunction = `async getInitialViewerCount() {
        // Quick timeout to prevent hanging
        const timeout = new Promise(resolve => setTimeout(() => {
            this.emit('update', { type: 'warning', message: '초기 시청자 수 확인 시간 초과, 건너뜁니다...' });
            resolve(null);
        }, 10000));
        
        const getCount = async () => {
            const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOU_API_KEY;
            const videoId = this.extractYouTubeVideoId(this.url);
            if (apiKey && videoId) {
                const count = await this.fetchYouTubeConcurrentViewers(videoId, apiKey);
                if (count !== null && count > 0) {
                    this.stats.initialViewerCount = count;
                    this.stats.currentViewerCount = count;
                    this.stats.viewerHistory.push({ time: new Date(), count });
                    this.emit('update', { type: 'success', message: \`✅ 초기 시청자 수 확인: \${count.toLocaleString()}명\` });
                    return count;
                }
            }
            return null;
        };
        
        return Promise.race([getCount(), timeout]);
    }`;

content = content.replace(oldFunction, newFunction);
fs.writeFileSync(viewbotPath, content);
console.log('✅ Added timeout wrapper to getInitialViewerCount');