"""
웹사이트 접속 시뮬레이션 도구 (Selenium 기반)
주의: 이 도구는 교육 목적으로만 사용하세요. 실제 웹사이트의 서비스 약관을 확인하고 준수하세요.
"""
import time
import random
import threading
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ViewBot:
    def __init__(self, url, num_threads=5, headless=True, min_delay=5, max_delay=15):
        """
        ViewBot 초기화
        
        Args:
            url: 접속할 URL
            num_threads: 동시 실행할 브라우저 수
            headless: 헤드리스 모드 사용 여부
            min_delay: 최소 대기 시간 (초)
            max_delay: 최대 대기 시간 (초)
        """
        self.url = url
        self.num_threads = num_threads
        self.headless = headless
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.running = False
        
    def create_driver(self):
        """새로운 Chrome 드라이버 인스턴스 생성"""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument('--headless')
        
        # 봇 탐지 회피를 위한 옵션들
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # User-Agent 설정
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]
        chrome_options.add_argument(f'user-agent={random.choice(user_agents)}')
        
        # 창 크기 랜덤화
        window_sizes = ['1920,1080', '1366,768', '1536,864', '1440,900']
        chrome_options.add_argument(f'--window-size={random.choice(window_sizes)}')
        
        try:
            driver = webdriver.Chrome(options=chrome_options)
            # WebDriver 속성 숨기기
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            return driver
        except Exception as e:
            logger.error(f"드라이버 생성 실패: {e}")
            return None
    
    def visit_page(self, thread_id):
        """단일 브라우저 인스턴스로 페이지 방문"""
        driver = None
        try:
            logger.info(f"[Thread {thread_id}] 브라우저 시작...")
            driver = self.create_driver()
            
            if not driver:
                logger.error(f"[Thread {thread_id}] 드라이버 생성 실패")
                return
            
            # 페이지 접속
            logger.info(f"[Thread {thread_id}] {self.url} 접속 중...")
            driver.get(self.url)
            
            # 페이지 로딩 대기
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            logger.info(f"[Thread {thread_id}] 페이지 로드 완료")
            
            # 랜덤한 시간 동안 페이지에 머무름
            stay_time = random.randint(self.min_delay, self.max_delay)
            logger.info(f"[Thread {thread_id}] {stay_time}초 동안 페이지에 머무름...")
            
            # 스크롤 시뮬레이션 (자연스러운 행동)
            for _ in range(random.randint(2, 5)):
                scroll_amount = random.randint(300, 800)
                driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                time.sleep(random.uniform(1, 3))
            
            time.sleep(stay_time)
            
            logger.info(f"[Thread {thread_id}] 세션 종료")
            
        except Exception as e:
            logger.error(f"[Thread {thread_id}] 오류 발생: {e}")
        finally:
            if driver:
                try:
                    driver.quit()
                    logger.info(f"[Thread {thread_id}] 브라우저 종료")
                except:
                    pass
    
    def start(self):
        """봇 시작"""
        if self.running:
            logger.warning("이미 실행 중입니다.")
            return
        
        self.running = True
        logger.info(f"ViewBot 시작: {self.url}")
        logger.info(f"동시 실행 스레드 수: {self.num_threads}")
        
        threads = []
        for i in range(self.num_threads):
            thread = threading.Thread(target=self.visit_page, args=(i+1,))
            thread.daemon = True
            threads.append(thread)
            thread.start()
            
            # 스레드 간 시작 시간 간격 (자연스러운 접속 패턴)
            time.sleep(random.uniform(0.5, 2.0))
        
        # 모든 스레드 완료 대기
        for thread in threads:
            thread.join()
        
        self.running = False
        logger.info("모든 세션이 완료되었습니다.")
    
    def start_continuous(self, interval=30):
        """지속적으로 실행 (일정 간격으로 반복)"""
        logger.info(f"지속 모드 시작 (간격: {interval}초)")
        try:
            while True:
                self.start()
                logger.info(f"{interval}초 후 다음 배치 시작...")
                time.sleep(interval)
        except KeyboardInterrupt:
            logger.info("사용자에 의해 중단되었습니다.")
            self.running = False


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='웹사이트 접속 시뮬레이션 도구')
    parser.add_argument('url', help='접속할 URL')
    parser.add_argument('-t', '--threads', type=int, default=5, help='동시 실행 스레드 수 (기본값: 5)')
    parser.add_argument('--no-headless', action='store_true', help='헤드리스 모드 비활성화 (브라우저 창 표시)')
    parser.add_argument('--min-delay', type=int, default=5, help='최소 대기 시간 (초)')
    parser.add_argument('--max-delay', type=int, default=15, help='최대 대기 시간 (초)')
    parser.add_argument('--continuous', action='store_true', help='지속 모드 (반복 실행)')
    parser.add_argument('--interval', type=int, default=30, help='지속 모드 간격 (초)')
    
    args = parser.parse_args()
    
    bot = ViewBot(
        url=args.url,
        num_threads=args.threads,
        headless=not args.no_headless,
        min_delay=args.min_delay,
        max_delay=args.max_delay
    )
    
    if args.continuous:
        bot.start_continuous(interval=args.interval)
    else:
        bot.start()


if __name__ == '__main__':
    main()
