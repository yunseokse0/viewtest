// Test complete flow with API fix
const ViewBot = require('./viewbot');

console.log('=== Testing Complete Flow with API Fix ===');

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

// Listen to all events
bot.on('update', (data) => {
    console.log(`[${data.type.toUpperCase()}] ${data.message}`);
});

bot.on('stats', (stats) => {
    console.log('[STATS] Initial:', stats.initialViewerCount, 'Current:', stats.currentViewerCount);
});

bot.on('error', (error) => {
    console.error('[ERROR]', error.message);
});

console.log('\nStarting bot...');
bot.start().then(() => {
    console.log('✅ Bot started successfully');
}).catch((error) => {
    console.error('❌ Bot failed to start:', error.message);
});

// Stop after 30 seconds
setTimeout(() => {
    console.log('\nStopping bot...');
    bot.stop();
    process.exit(0);
}, 30000);