// Debug viewbot startup
const ViewBot = require('./viewbot');

console.log('=== ViewBot Debug Test ===');

const url = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
const options = {
    numInstances: 1,
    minDelay: 5000,
    maxDelay: 15000,
    headless: true,
    playMuted: true
};

console.log('Creating ViewBot instance...');
console.log('URL:', url);
console.log('Options:', JSON.stringify(options, null, 2));

const bot = new ViewBot(url, options);

// Listen to all events
bot.on('update', (data) => {
    console.log(`[UPDATE] ${data.type}: ${data.message}`);
});

bot.on('stats', (stats) => {
    console.log('[STATS]', JSON.stringify(stats, null, 2));
});

bot.on('error', (error) => {
    console.error('[ERROR]', error.message);
});

console.log('\nStarting bot...');
bot.start().then(() => {
    console.log('✅ Bot started successfully');
}).catch((error) => {
    console.error('❌ Bot failed to start:', error.message);
    console.error(error.stack);
});

// Stop after 30 seconds
setTimeout(() => {
    console.log('\nStopping bot...');
    bot.stop().then(() => {
        console.log('✅ Bot stopped');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Failed to stop bot:', error.message);
        process.exit(1);
    });
}, 30000);