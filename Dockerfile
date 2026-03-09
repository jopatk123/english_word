# 构建阶段 - 前端
FROM node:18-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# 构建阶段 - 后端依赖
FROM node:18-alpine AS backend-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

# 最终运行镜像
FROM node:18-alpine
WORKDIR /app

# 复制后端
COPY server/ ./server/
COPY --from=backend-deps /app/server/node_modules ./server/node_modules

# 复制前端构建产物
COPY --from=frontend-build /app/client/dist ./client/dist

# 创建数据目录
RUN mkdir -p /app/data

ENV PORT=3010
ENV DB_PATH=/app/data/words.db
EXPOSE 3010

CMD ["node", "server/index.js"]
