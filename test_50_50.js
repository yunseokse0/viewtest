// 50명 50분 테스트 스크립트
const ViewBot = require('./viewbot');

console.log('=== 50명 50분 테스트 시작 ===');
console.log('시작 시간:', new Date().toLocaleString());

const url = 'https://www.youtube.com/watch?v=jfKfPfyJRdk'; // Lofi Girl
const options = {
    numInstances: 50,
    minDelay: 2000,  // 2초 최소 지연
    maxDelay: 5000,  // 5초 최대 지연
    headless: true,  // 백그라운드 실행
    playMuted: true, // 음소거 재생
    duration: 3000   // 50분 (3000초)
};

console.log('설정:');
console.log('- 인스턴스:', options.numInstances);
console.log('- 지연 시간:', options.minDelay/1000, '-', options.maxDelay/1000, '초');
console.log('- 실행 시간:', options.duration/60, '분');
console.log('- 대상 URL:', url);

const bot = new ViewBot(url, options);

// 이벤트 리스닝
let successCount = 0;
let failCount = 0;

bot.on('update', (data) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${data.message}`);
    
    if (data.message.includes('페이지 로드 완료')) {
        successCount++;
    }
    if (data.message.includes('실패')) {
        failCount++;
    }
});

bot.on('stats', (stats) => {
    console.log(`[${new Date().toLocaleTimeString()}] 📊 통계 - 초기: ${stats.initialViewerCount}, 현재: ${stats.currentViewerCount}, 성공: ${successCount}, 실패: ${failCount}`);
});

bot.on('error', (error) => {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ 오류:`, error.message);
    failCount++;
});

bot.on('complete', () => {
    const endTime = new Date().toLocaleString();
    console.log(`\n=== 테스트 완료 ===`);
    console.log(`종료 시간: ${endTime}`);
    console.log(`총 성공: ${successCount}`);
    console.log(`총 실패: ${failCount}`);
    console.log(`성공률: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
});

// 시작
console.log('\n🚀 봇 시작 중...');
bot.start().catch((error) => {
    console.error('시작 실패:', error);
    process.exit(1);
});

// 50분 후 자동 종료
setTimeout(() => {
    console.log('\n⏰ 50분 경과 - 종료 중...');
    bot.stop();
    process.exit(0);
}, 3000000); // 50분 = 3,000,000ms