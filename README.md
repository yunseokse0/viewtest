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

### 🖥️ 두 가지 모드 (분석 문서 기준)

| 모드 | 실행 방법 | 동작 | 시청자 수 반영 |
|------|------------|------|----------------|
| **실제 브라우저 (플레이어 로드)** | `npm run server` | Puppeteer로 실제 브라우저·플레이어 로드 | **반영될 수 있음** |
| **요청 전송만** | `npm run dev` 또는 Vercel 배포 | `fetch` no-cors로 GET만 전송 | **미반영** (분석 문서 참고) |

**로컬에서 완전히 실행 (실제 시청자 수 반영 + 통계 표시):**

1. 의존성 설치 및 서버 실행:
```bash
npm install
npm run server
```

2. 브라우저에서 **http://localhost:3000** 접속. "모드: 실제 브라우저 (플레이어 로드)"가 보이면 정상.

3. **YouTube 시청자 수** 패널을 쓰려면 **YOUTUBE_API_KEY** 설정:
   - 프로젝트 루트에 `.env` 파일을 만들고 다음 한 줄 추가:
     `YOUTUBE_API_KEY=여기에_발급받은_API키`
   - 또는 터미널에서: `set YOUTUBE_API_KEY=여기에_키` (Windows) / `export YOUTUBE_API_KEY=여기에_키` (Mac/Linux) 후 `npm run server`
   - API 키는 [Google Cloud Console](https://console.cloud.google.com/) → YouTube Data API v3 사용 설정 후 발급.

4. 라이브 중인 YouTube URL 입력, 요청 수 2~5로 두고 **시작** 클릭. 로그에 "브라우저 시작", "페이지 로드 완료", "비디오 재생 중" 등이 뜨면 실제 브라우저 모드로 동작 중입니다.

**로컬에서 API만 테스트 (요청 전송만):**

```bash
npm run dev
```

- 앱 UI와 `/api/youtube-viewers` API가 같은 서버에서 동작합니다.  
- 이 모드에서는 시청자 수가 증가하지 않습니다 (분석: `docs/알고리즘_시청자증가_분석.md`).

**Vercel에서는 "실제 브라우저" 모드가 안 되는 이유:**  
Vercel은 서버리스(요청 시에만 함수 실행)라, Puppeteer로 브라우저를 오래 켜 두는 구조와 맞지 않습니다. 그래서 Vercel에 배포하면 항상 "요청 전송만" 모드만 되고, 시청자 수는 증가하지 않습니다. 자세한 이유: `docs/Vercel에서_실제작동_불가_이유.md`

**클라우드에서 "실제 작동"을 원할 때 (Railway 배포):**

이 저장소에는 **Dockerfile**이 포함되어 있어, Railway에서 **실제 브라우저(플레이어 로드)** 모드로 바로 배포할 수 있습니다.

1. [Railway](https://railway.app) 로그인 후 **New Project** → **Deploy from GitHub repo** 선택.
2. 이 저장소(`viewtest`)를 연결하고, **Deploy** 시작.
3. Railway가 **Dockerfile**을 감지해 Node + Chromium 환경으로 빌드하고 `node server.js`를 실행합니다.
4. 배포가 끝나면 **Settings** → **Generate Domain**으로 URL을 생성합니다.
5. 해당 URL로 접속하면 **"모드: 실제 브라우저 (플레이어 로드)"**가 표시되고, 시청자 수에 반영될 수 있는 방식으로 동작합니다.

**참고:** 무료 티어는 메모리 제한이 있어 동시 인스턴스 수를 5~10개 정도로 두는 것이 안정적입니다. 유료 플랜에서는 더 많이 설정할 수 있습니다.

**Vercel 배포 후 API가 404일 때:**

1. Vercel 대시보드 → 프로젝트 → **Settings** → **General**  
   - **Root Directory**: 비워 두거나 `.` (저장소 루트). `public` 등으로 두면 `api/` 폴더가 배포되지 않아 404가 납니다.
2. **Environment Variables**에 `YOUTUBE_API_KEY` 추가 후 재배포.

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
