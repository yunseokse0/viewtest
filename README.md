# ViewBot - 웹사이트 접속 시뮬레이션 도구

Selenium (Python)과 Puppeteer (Node.js)를 사용한 브라우저 자동화 도구입니다.

⚠️ **중요한 주의사항**
- 이 도구는 **교육 및 학습 목적**으로만 사용하세요.
- 실제 웹사이트에 사용하기 전에 해당 사이트의 **서비스 약관**을 확인하세요.
- 과도한 요청은 DDoS 공격으로 간주될 수 있으며 **법적 문제**가 발생할 수 있습니다.
- 책임감 있게 사용하시기 바랍니다.

## 기능

- Headless 브라우저를 사용한 자동 페이지 접속
- 다중 브라우저 인스턴스 동시 실행
- 자연스러운 사용자 행동 시뮬레이션 (스크롤, 대기 시간 등)
- 랜덤 User-Agent 및 Viewport 설정
- 봇 탐지 회피 기능

## 설치

### Python 버전 (Selenium)

1. Python 3.7 이상 설치
2. Chrome 브라우저 설치
3. ChromeDriver 설치 (또는 자동 설치)

```bash
pip install -r requirements.txt
```

ChromeDriver는 Selenium 4.6+ 버전에서 자동으로 관리됩니다.

### Node.js 버전 (Puppeteer)

1. Node.js 14 이상 설치
2. 패키지 설치:

```bash
npm install
```

Puppeteer는 설치 시 자동으로 Chromium을 다운로드합니다.

## 사용법

### 🌐 웹 인터페이스 (추천)

가장 쉬운 방법은 웹 인터페이스를 사용하는 것입니다:

```bash
# 의존성 설치
npm install

# 서버 시작
npm run server
# 또는
node server.js
```

브라우저에서 `http://localhost:3000`으로 접속하여 사용할 수 있습니다.

**웹 인터페이스 기능:**
- 직관적인 UI로 URL 입력 및 설정
- 실시간 통계 표시 (총 접속 수, 진행 중, 완료, 실패)
- 실시간 로그 표시
- 실행 시간 추적

### Python 버전 (CLI)

```bash
# 기본 사용 (5개 스레드, 헤드리스 모드)
python viewbot.py https://example.com

# 옵션 지정
python viewbot.py https://example.com --threads 10 --min-delay 10 --max-delay 30

# 브라우저 창 표시
python viewbot.py https://example.com --no-headless

# 지속 모드 (반복 실행)
python viewbot.py https://example.com --continuous --interval 60
```

**옵션:**
- `-t, --threads`: 동시 실행 스레드 수 (기본값: 5)
- `--no-headless`: 헤드리스 모드 비활성화
- `--min-delay`: 최소 대기 시간 (초)
- `--max-delay`: 최대 대기 시간 (초)
- `--continuous`: 지속 모드 활성화
- `--interval`: 지속 모드 간격 (초)

### Node.js 버전 (CLI)

```bash
# 기본 사용
node viewbot.js https://example.com

# 옵션 지정
node viewbot.js https://example.com --instances 10 --min-delay 10000 --max-delay 30000

# 브라우저 창 표시
node viewbot.js https://example.com --no-headless

# 지속 모드
node viewbot.js https://example.com --continuous --interval 60000
```

**옵션:**
- `--instances <숫자>`: 동시 실행 인스턴스 수 (기본값: 5)
- `--no-headless`: 헤드리스 모드 비활성화
- `--min-delay <밀리초>`: 최소 대기 시간 (기본값: 5000)
- `--max-delay <밀리초>`: 최대 대기 시간 (기본값: 15000)
- `--continuous`: 지속 모드 활성화
- `--interval <밀리초>`: 지속 모드 간격 (기본값: 30000)

## 테스트 방법

### 실제 접속 확인하기

ViewBot이 정상적으로 작동하는지 확인하려면 테스트 서버를 사용하세요:

```bash
# 별도 터미널에서 테스트 서버 실행
node test-server.js
```

그 다음 ViewBot 웹 인터페이스에서 `http://localhost:8080`으로 접속하면, 테스트 서버 콘솔에 접속 로그가 표시됩니다.

### YouTube 시청자 수에 대한 중요 안내

⚠️ **중요**: YouTube 시청자 수는 단순히 페이지를 방문하는 것만으로는 증가하지 않습니다.

YouTube는 다음과 같은 요구사항이 있습니다:
- 실제 비디오 재생 필요
- 최소 시청 시간 (보통 30초 이상)
- 고급 봇 탐지 시스템으로 인한 필터링
- IP 주소, 쿠키, 브라우저 지문 등 다양한 요소 검증

이 도구는 **웹사이트 접속 시뮬레이션**을 학습하기 위한 것이며, YouTube 시청자 수 조작을 위한 도구가 아닙니다.

## 예제

### Python 예제

```python
from viewbot import ViewBot

# 기본 사용
bot = ViewBot('https://example.com', num_threads=5)
bot.start()

# 지속 모드
bot = ViewBot('https://example.com', num_threads=10, headless=True)
bot.start_continuous(interval=60)  # 60초마다 반복
```

### Node.js 예제

```javascript
const ViewBot = require('./viewbot');

// 기본 사용
const bot = new ViewBot('https://example.com', {
    numInstances: 5,
    headless: true,
    minDelay: 5000,
    maxDelay: 15000
});

bot.start();

// 지속 모드
bot.startContinuous(60000);  // 60초마다 반복
```

## 기술적 세부사항

### 봇 탐지 회피 기능

- 랜덤 User-Agent 설정
- 랜덤 Viewport 크기
- WebDriver 속성 숨기기
- 자연스러운 스크롤 패턴
- 랜덤 대기 시간

### 주의사항

1. **ChromeDriver 버전**: Chrome 브라우저 버전과 호환되는 ChromeDriver가 필요합니다.
2. **리소스 사용**: 다수의 브라우저 인스턴스는 CPU와 메모리를 많이 사용합니다.
3. **네트워크**: 과도한 요청은 네트워크 대역폭을 소모합니다.

## 라이선스

MIT License

## 면책 조항

이 도구는 교육 목적으로 제공됩니다. 사용자가 이 도구를 사용하여 발생하는 모든 문제에 대한 책임은 사용자에게 있습니다. 불법적이거나 비윤리적인 용도로 사용하지 마세요.
