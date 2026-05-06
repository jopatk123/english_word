# 📖 词根背单词工具

基于词根记忆法的多用户英语学习工具，包含词根/单词/例句管理、SRS 复习、学习计时、AI 辅助和超级管理员后台。前端构建产物由 Express 统一托管，API 与页面共用同一个服务入口。

## 功能概览

- 用户注册、登录与多用户数据隔离
- 词根、单词、例句的增删改查，自动维护“未分类”默认词根
- 首页搜索，支持按词根/单词名称和含义模糊匹配，单词结果可自动朗读
- 背单词系统：今日到期、超期、学习中、已掌握、继续学习等视图与学习报表
- 学习计时：服务端权威状态、WebSocket 实时同步、统计与导出
- AI 辅助：词根建议、单词建议、例句建议、单词分析、句子分析
- 全量数据导出/导入：导入时若目标账号尚未拥有“未分类”默认词根，会自动创建后再恢复关联
- 超级管理员后台：前端路由为 `/super-admin`，可查看用户、重置密码、启停账号、删除用户

## 技术栈

- 后端：Node.js、Express、Sequelize、SQLite、ws
- 前端：Vue 3、Vite、Element Plus、ECharts
- 测试：Vitest、Supertest
- 部署：Docker、Docker Compose

## 运行架构

- HTTP 页面与 API 由同一个 Express 服务提供
- 用户接口统一挂在 `/api/*`
- 超级管理员接口挂在 `/api/admin/*`
- 学习计时实时通道为 `/ws/study-timer`
- 生产环境前端静态资源来自 `client/dist`

## 部署前必读

- `PORT`、`DB_PATH`、`JWT_SECRET`、`ADMIN_PASSWORD` 全部必填
- 项目已移除运行时和 Docker 部署层的默认值；任一变量缺失或为空，部署会直接失败
- Docker 部署时，`DB_PATH` 应填写容器内持久化目录，例如 `/app/data/words.db`
- 本地开发时，`DB_PATH` 应填写宿主机路径，例如 `./data/words.dev.db`
- `PORT` 同时用于服务监听端口和 Docker 对外映射端口

## Docker 部署

### 1. 准备环境变量

```bash
git clone <仓库地址>
cd english_word
cp .env.example .env
```

按 Docker 部署方式编辑 `.env`，例如：

```env
PORT=3010
DB_PATH=/app/data/words.db
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

如果任一变量为空，`docker compose build` 或 `docker compose up` 会直接失败，而不会再使用默认值继续启动。

### 2. 构建并启动

```bash
docker compose build
docker compose up -d
```

### 3. 访问地址

- 用户端：首页 `http://localhost:3010/`
- 超级管理员页面 `http://localhost:3010/super-admin`

如果你把 `PORT` 改成了其他值，请将上面的 `3010` 替换为你的实际端口。

### 4. 停止服务

```bash
docker compose down
```

### 5. 数据持久化

- Docker 默认把 `/app/data` 挂到命名卷 `english-word-db`
- 数据库实际文件位置由 `DB_PATH` 决定，建议保持在 `/app/data/` 目录内

## 本地开发

### 1. 准备 `.env`

```bash
cp .env.example .env
```

按本地开发方式填写，例如：

```env
PORT=3010
DB_PATH=./data/words.dev.db
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

### 2. 安装依赖

```bash
npm --prefix server install
npm --prefix client install
```

如果你需要在根目录统一执行 `npm test`、`npm run lint` 等命令，再额外执行一次：

```bash
npm install
```

### 3. 启动开发环境

```bash
npm --prefix server run dev
npm --prefix client run dev
```

- 后端默认按 `.env` 中的 `PORT` 监听
- 前端 Vite 开发服务器默认地址为 `http://localhost:5173`
- 本地开发时，`client/vite.config.js` 会把 `/api` 和 `/ws` 代理到 `http://localhost:3010`
- 如果你修改了本地后端端口，需要同步更新 `client/vite.config.js` 中的代理目标

## 常用命令

```bash
# 统一运行前后端测试
npm test

# 统一检查代码风格
npm run lint

# 生成覆盖率报告
npm run test:coverage
```

## 环境变量说明

| 变量名           | 是否必填 | 说明                                                                              |
| ---------------- | -------- | --------------------------------------------------------------------------------- |
| `PORT`           | 是       | 服务监听端口；Docker 对外映射也使用同一个端口                                     |
| `DB_PATH`        | 是       | SQLite 文件路径；Docker 建议 `/app/data/words.db`，本地建议 `./data/words.dev.db` |
| `JWT_SECRET`     | 是       | 用户登录与管理员 token 的签名密钥                                                 |
| `ADMIN_PASSWORD` | 是       | 超级管理员登录密码，对应页面为 `/super-admin`                                     |

## 项目结构

```text
english_word/
├── client/
│   ├── src/
│   │   ├── api/                # 前端 API 封装
│   │   ├── components/         # 组件（含 admin、study 等）
│   │   ├── router/             # 前端路由
│   │   ├── views/              # 页面视图
│   │   └── utils/              # 前端工具与本地状态同步
│   └── vite.config.js          # 本地开发代理配置
├── server/
│   ├── app.js                  # Express 应用装配
│   ├── index.js                # 服务启动入口
│   ├── config/                 # 数据库配置
│   ├── middleware/             # 认证与管理员鉴权
│   ├── models/                 # Sequelize 模型
│   ├── realtime/               # WebSocket 实时能力
│   ├── routes/                 # API 路由
│   ├── services/               # 服务端业务服务
│   └── utils/                  # 工具函数与环境变量读取
├── data/                       # 本地 SQLite 文件目录
├── Dockerfile
├── docker-compose.yml
├── start.sh
└── README.md
```
