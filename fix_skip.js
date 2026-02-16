// Direct fix for hanging issue
const fs = require('fs');
const path = require('path');

const viewbotPath = path.join(__dirname, 'viewbot.js');
let content = fs.readFileSync(viewbotPath, 'utf8');

// Add a simple skip mechanism
const insertCode = `
    async getInitialViewerCount() {
        // Skip initial viewer count to prevent hanging
        this.emit('update', { type: 'info', message: '초기 시청자 수 확인을 건너뜁니다...' });
        return null;
    }
`;

// Find the original function and replace it
const functionStart = content.indexOf('async getInitialViewerCount() {');
const functionEnd = content.indexOf('\n    async', functionStart + 1);

if (functionStart !== -1 && functionEnd !== -1) {
    const newContent = content.substring(0, functionStart) + insertCode + content.substring(functionEnd);
    fs.writeFileSync(viewbotPath, newContent);
    console.log('✅ Replaced getInitialViewerCount with skip function');
} else {
    console.log('❌ Could not find function to replace');
}