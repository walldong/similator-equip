# 合并前后端的 Dockerfile + nginx 代理
FROM node:20-alpine

# 安装 nginx
RUN apk add --no-cache nginx

WORKDIR /app

# 设置 npm 国内镜像
RUN npm config set registry https://registry.npmmirror.com

# ============ 后端依赖 ============
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm ci --only=production || npm install --only=production

# ============ 前端依赖 ============
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./frontend/
WORKDIR /app/frontend
RUN npm ci || npm install

# ============ 前端构建 ============
WORKDIR /app/frontend
COPY next.config.ts tsconfig.json next-env.d.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# ============ 整理前端文件 ============
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public .next/standalone/ && \
    cp -r .next/server .next/standalone/.next/

# ============ 后端源码 ============
WORKDIR /app
COPY backend/server.js backend/gameLogic.js backend/database-mysql.js backend/cache-redis.js backend/mapConfig.js backend/mapGenerator.js backend/equipmentNamer.js backend/config.js backend/service.js backend/gameBalance.js ./backend/

# ============ nginx 配置 ============
COPY nginx.conf /etc/nginx/nginx.conf

# ============ 启动脚本 ============
WORKDIR /app
RUN printf '#!/bin/sh\necho "Waiting for MySQL..."\ncd /app/backend && node -e "\nconst net = require('net');\nconst check = () => {\n  const socket = net.connect(3306, 'mysql');\n  socket.on('connect', () => { socket.end(); process.exit(0); });\n  socket.on('error', () => { socket.destroy(); setTimeout(check, 1000); });\n};\ncheck();\n"\necho "MySQL is ready!"\necho "Starting backend (port 3002)..."\ncd /app/backend && PORT=3002 HOSTNAME=127.0.0.1 node server.js &\necho "Starting frontend (port 3001)..."\ncd /app/frontend/.next/standalone && PORT=3001 HOSTNAME=127.0.0.1 BACKEND_URL=http://127.0.0.1:3002 node server.js &\nsleep 2\necho "Starting nginx (port 3000)..."\nnginx -g "daemon off;"\n' > start.sh && \
    chmod +x start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["./start.sh"]