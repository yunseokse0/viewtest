// 점진적 증가 테스트 - 사용자 채널 전용 (300명 2시간)
const ViewBot = require('./viewbot');

console.log('=== 사용자 채널 점진적 증가 테스트 시작 ===');
console.log('시작 시간:', new Date().toLocaleString());
console.log('채널: https://www.youtube.com/watch?v=9aIHJ3cKsLo');

const config = {
    url: 'https://www.youtube.com/watch?v=9aIHJ3cKsLo',
    startInstances: 25,
    targetInstances: 300,
    totalDuration: 120, // 2시간
    increaseInterval: 15, // 15분마다 증가
    increaseStep: 25, // 25명씩 증가
    headless: true
};

console.log('\n📋 설정:');
console.log('- URL:', config.url);
console.log('- 시작 인스턴스:', config.startInstances, '명');
console.log('- 목표 인스턴스:', config.targetInstances, '명');
console.log('- 총 시간:', config.totalDuration, '분');
console.log('- 증가 간격:', config.increaseInterval, '분');
console.log('- 증가 단계:', config.increaseStep, '명');

// 진행 상황 추적
let totalInstances = 0;
let successCount = 0;
let failCount = 0;
let startTime = Date.now();

// 배치 시작 함수
async function startBatch(instances, delay = 0) {
    if (delay > 0) {
        console.log(`⏰ ${delay/1000}초 후 ${instances}명 배치 시작...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const options = {
        numInstances: instances,
        minDelay: 3000, // 3초
        maxDelay: 8000, // 8초
        headless: config.headless,
        playMuted: true,
        duration: config.totalDuration * 60 * 1000 // 전체 지속 시간
    };
    
    const bot = new ViewBot(config.url, options);
    
    bot.on('update', (data) => {
        const timestamp = new Date().toLocaleTimeString();
        if (data.message.includes('페이지 로드 완료')) {
            successCount++;
            console.log(`[${timestamp}] ✅ ${data.message} (${successCount}/${totalInstances})`);
        } else if (data.message.includes('시작')) {
            console.log(`[${timestamp}] 🚀 ${data.message}`);
        } else if (data.message.includes('시청자')) {
            console.log(`[${timestamp}] 👥 ${data.message}`);
        }
    });
    
    bot.on('error', (error) => {
        failCount++;
        console.error(`[${new Date().toLocaleTimeString()}] ❌ 오류:`, error.message);
    });
    
    bot.on('complete', () => {
        console.log(`[${new Date().toLocaleTimeString()}] 📊 배치 완료: ${instances}명`);
    });
    
    try {
        await bot.start();
        totalInstances += instances;
        console.log(`📈 총 인스턴스: ${totalInstances}/${config.targetInstances}`);
    } catch (error) {
        console.error('배치 시작 실패:', error.message);
        failCount += instances;
    }
}

// 점진적 증가 스케줄
async function runProgressiveScaling() {
    console.log('\n🎯 점진적 증가 시작...');
    
    // 1단계: 시작 배치
    await startBatch(config.startInstances);
    
    // 증가 스케줄
    const steps = Math.ceil((config.targetInstances - config.startInstances) / config.increaseStep);
    
    for (let i = 1; i <= steps; i++) {
        const nextTime = i * config.increaseInterval * 60 * 1000; // 밀리초
        const currentInstances = config.startInstances + (i * config.increaseStep);
        const actualIncrease = Math.min(config.increaseStep, config.targetInstances - (config.startInstances + ((i-1) * config.increaseStep)));
        
        if (actualIncrease > 0) {
            setTimeout(() => {
                console.log(`\n📈 ${i * config.increaseInterval}분 경과 - 인스턴스 증가: +${actualIncrease}명`);
                startBatch(actualIncrease);
            }, nextTime);
        }
    }
    
    // 종료 타이머
    setTimeout(() => {
        console.log('\n🏁 2시간 완료 - 종료 중...');
        const endTime = new Date().toLocaleString();
        const duration = (Date.now() - startTime) / 1000 / 60;
        
        console.log('\n=== 최종 결과 ===');
        console.log('종료 시간:', endTime);
        console.log('실행 시간:', duration.toFixed(1), '분');
        console.log('총 인스턴스:', totalInstances);
        console.log('성공:', successCount);
        console.log('실패:', failCount);
        console.log('성공률:', ((successCount / totalInstances) * 100).toFixed(1) + '%');
        
        process.exit(0);
    }, config.totalDuration * 60 * 1000);
}

// 시작
runProgressiveScaling().catch(error => {
    console.error('점진적 증가 실패:', error);
    process.exit(1);
});

// 시스템 모니터링
setInterval(() => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    console.log(`\n📊 시스템 상태 (${new Date().toLocaleTimeString()})`);
    console.log('- 메모리 사용:', (memUsage.heapUsed / 1024 / 1024).toFixed(1), 'MB');
    console.log('- 실행 시간:', (uptime / 60).toFixed(1), '분');
    console.log('- 현재 인스턴스:', totalInstances, '명');
    console.log('- 성공률:', ((successCount / Math.max(totalInstances, 1)) * 100).toFixed(1) + '%');
}, 300000); // 5분마다