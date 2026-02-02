# 실제 브라우저(플레이어 로드) 모드용 - Railway/Render 등에서 server.js 실행
FROM node:20-bookworm-slim

# Puppeteer가 다운로드한 Chromium 실행에 필요한 런타임 라이브러리
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Puppeteer가 Chromium을 다운로드함 (PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 미설정)
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
