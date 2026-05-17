# 构建阶段 - 前端
FROM node:20-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# 构建阶段 - 后端依赖
FROM node:20-alpine AS backend-deps
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci --omit=dev

# 最终运行镜像
FROM node:20-alpine
WORKDIR /app

# 复制后端
COPY server/ ./server/
COPY --from=backend-deps /app/server/node_modules ./server/node_modules

# 复制前端构建产物
COPY --from=frontend-build /app/client/dist ./client/dist

# 创建数据目录
RUN mkdir -p /app/data && chown -R node:node /app

USER node

CMD ["node", "server/index.js"]
