// Test direct connection with viewbot
const { spawn } = require('child_process');

console.log('=== Testing Direct Connection Mode ===');

const testUrl = 'https://www.youtube.com/watch?v=jfKfPfyJRdk'; // Lofi Girl
const args = [testUrl, '--instances', '1', '--headless', 'false', '--duration', '30'];

console.log(`Running: node viewbot.js ${args.join(' ')}`);

const bot = spawn('node', ['viewbot.js', ...args], {
    stdio: 'pipe',
    cwd: __dirname
});

let output = '';
let errorOutput = '';

bot.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    process.stdout.write(text);
});

bot.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    process.stderr.write(text);
});

bot.on('close', (code) => {
    console.log(`\n=== Test Complete ===`);
    console.log(`Exit code: ${code}`);
    
    // Analyze results
    if (output.includes('시청자 수')) {
        console.log('✅ Viewer count extraction working');
    } else {
        console.log('❌ No viewer count extraction detected');
    }
    
    if (output.includes('직접 연결')) {
        console.log('✅ Direct connection mode active');
    }
    
    if (output.includes('페이지 로드 완료')) {
        console.log('✅ Page loading successful');
    }
    
    if (code === 0) {
        console.log('✅ Bot completed successfully');
    } else {
        console.log('❌ Bot exited with errors');
    }
});

// Timeout after 60 seconds
setTimeout(() => {
    if (bot.killed) return;
    console.log('⏰ Test timeout - killing process');
    bot.kill('SIGTERM');
}, 60000);