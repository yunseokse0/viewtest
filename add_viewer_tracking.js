// Add missing startViewerTracking function
const fs = require('fs');
const path = require('path');

const viewbotPath = path.join(__dirname, 'viewbot.js');
let content = fs.readFileSync(viewbotPath, 'utf8');

// Add the missing startViewerTracking function
const viewerTrackingFunction = `
    /**
     * 시청자 수 추적 시작
     */
    startViewerTracking() {
        if (this.viewerTrackingInterval) {
            clearInterval(this.viewerTrackingInterval);
        }
        
        // 30초마다 시청자 수 업데이트
        this.viewerTrackingInterval = setInterval(async () => {
            if (!this.running) {
                clearInterval(this.viewerTrackingInterval);
                return;
            }
            
            const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOU_API_KEY;
            const videoId = this.extractYouTubeVideoId(this.url);
            if (apiKey && videoId) {
                try {
                    const viewerCount = await this.fetchYouTubeConcurrentViewers(videoId, apiKey);
                    if (viewerCount !== null && viewerCount > 0) {
                        const previousCount = this.stats.currentViewerCount;
                        this.stats.currentViewerCount = viewerCount;
                        this.stats.viewerHistory.push({ time: new Date(), count: viewerCount });
                        if (this.stats.viewerHistory.length > 100) {
                            this.stats.viewerHistory.shift();
                        }
                        if (previousCount !== null && previousCount > 0) {
                            const change = viewerCount - previousCount;
                            const changePercent = ((change / previousCount) * 100).toFixed(1);
                            if (Math.abs(change) > 0) {
                                this.emit('update', { 
                                    type: change > 0 ? 'success' : 'info', 
                                    message: \`📊 시청자 수: \${viewerCount.toLocaleString()}명 (\${change >= 0 ? '+' : ''}\${change}, \${changePercent}%)\` 
                                });
                            }
                        } else if (previousCount === null && this.stats.initialViewerCount !== null) {
                            const change = viewerCount - this.stats.initialViewerCount;
                            const changePercent = ((change / this.stats.initialViewerCount) * 100).toFixed(1);
                            this.emit('update', { 
                                type: change > 0 ? 'success' : 'info', 
                                message: \`📊 시청자 수: \${viewerCount.toLocaleString()}명 (초기 대비 \${change >= 0 ? '+' : ''}\${change}, \${changePercent}%)\` 
                            });
                        } else {
                            this.emit('update', { 
                                type: 'info', 
                                message: \`📊 현재 시청자 수: \${viewerCount.toLocaleString()}명\` 
                            });
                        }
                        this.emit('stats', this.stats);
                    }
                } catch (error) {
                    // API 호출 실패 시 무시
                }
            }
        }, 30000); // 30초마다 업데이트
    }
`;

// Find where to insert the function (after getInitialViewerCount)
const insertPoint = content.indexOf('async getInitialViewerCount() {');
if (insertPoint !== -1) {
    // Find the end of getInitialViewerCount function
    let braceCount = 0;
    let i = insertPoint;
    let inFunction = false;
    
    while (i < content.length) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (content.substring(i, i + 16) === 'async getInitial' && inFunction) break;
        if (braceCount > 0) inFunction = true;
        if (braceCount === 0 && inFunction) {
            // Found the end of the function
            const insertPosition = i + 1;
            content = content.substring(0, insertPosition) + viewerTrackingFunction + content.substring(insertPosition);
            break;
        }
        i++;
    }
    
    fs.writeFileSync(viewbotPath, content);
    console.log('✅ Added startViewerTracking function');
} else {
    console.log('❌ Could not find insertion point');
}