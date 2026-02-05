# ViewBot 서버 재시작 (3000 포트 정리 후 실행)
$port = 3000
Write-Host "3000 포트 사용 프로세스 확인 중..."
$found = netstat -ano | findstr ":$port.*LISTENING"
if ($found) {
    $line = $found -split '\s+' | Where-Object { $_ -match '^\d+$' }
    $pid = $line[-1]
    if ($pid) {
        Write-Host "PID $pid 종료 중..."
        taskkill /PID $pid /F 2>$null
        Start-Sleep -Seconds 2
    }
}
Set-Location $PSScriptRoot
Write-Host "서버 시작: npm run server"
Write-Host "브라우저에서 http://localhost:3000 접속하세요."
node server.js
