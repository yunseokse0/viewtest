/**
 * 테스트용 간단한 서버
 * 실제 접속을 확인할 수 있는 로그 서버
 */
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const timestamp = new Date().toISOString();
    
    // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // 접속 로그 출력
    console.log(`[${timestamp}] 접속: ${req.headers['user-agent']}`);
    console.log(`[${timestamp}] IP: ${req.socket.remoteAddress}`);
    console.log(`[${timestamp}] URL: ${parsedUrl.pathname}`);
    console.log('---');
    
    // 간단한 HTML 응답
    res.writeHead(200);
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ViewBot 테스트 페이지</title>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #667eea; }
                .info {
                    background: #e3f2fd;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .timestamp {
                    color: #666;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>✅ ViewBot 테스트 페이지</h1>
                <div class="info">
                    <p><strong>접속 성공!</strong></p>
                    <p class="timestamp">접속 시간: ${timestamp}</p>
                    <p>이 페이지에 접속했다는 것은 ViewBot이 정상적으로 작동하고 있다는 의미입니다.</p>
                </div>
                <h2>접속 정보</h2>
                <ul>
                    <li><strong>User-Agent:</strong> ${req.headers['user-agent']}</li>
                    <li><strong>IP 주소:</strong> ${req.socket.remoteAddress}</li>
                    <li><strong>요청 경로:</strong> ${parsedUrl.pathname}</li>
                </ul>
                <p style="margin-top: 30px; color: #666;">
                    이 페이지는 ViewBot이 실제로 웹사이트에 접속하는지 테스트하기 위한 페이지입니다.
                </p>
            </div>
        </body>
        </html>
    `);
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`\n✅ 테스트 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`ViewBot에서 이 URL로 접속하면 서버 콘솔에 접속 로그가 표시됩니다.\n`);
});
