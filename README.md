# 📖 词根背单词工具

基于"词根记忆法"的个人背单词工具，支持词根、单词、例句的增删改查管理，数据本地存储，Docker 一键部署。

## 技术栈

- **后端**：Node.js + Express + Sequelize + SQLite
- **前端**：Vue 3 + Vite + Element Plus
- **部署**：Docker + Docker Compose

## 快速部署

### 前提条件

已安装 [Docker](https://www.docker.com/) 和 Docker Compose。

### 环境变量

首次启动前，先复制环境变量模板并填写 JWT 密钥：

```bash
cp .env.example .env
```

- `JWT_SECRET`：必填，用于签发登录 token，必须替换为高强度随机字符串
- `PORT`：可选，服务端监听端口，默认 `3010`
- `DB_PATH`：可选，SQLite 数据文件路径；本地默认 `./data/words.db`

### 启动步骤

```bash
# 1. 克隆项目
git clone <仓库地址>
cd english_word

# 2. 准备环境变量
cp .env.example .env

# 3. 构建镜像
docker-compose build

# 4. 启动服务
docker-compose up -d

# 5. 访问
# 浏览器打开 http://localhost:3010
```

### 停止服务

```bash
docker-compose down
```

## 核心功能

### 词根管理

- 添加、编辑、删除词根（删除时级联删除关联单词和例句）
- 查看词根列表及关联单词数量

### 单词管理

- 为指定词根添加单词（支持填写音标、备注）
- 编辑、删除单词（删除时级联删除关联例句）

### 例句管理

- 为指定单词添加例句（支持备注标签，如"高频考点"）
- 编辑、删除例句

### 搜索

- 支持按词根或单词模糊搜索

### AI 智能补充

- 首页可配置 AI 厂商、Base URL、模型与 API Key，配置仅保存在当前浏览器本地
- 支持智能分析现有词根，批量推荐并添加尚未收录的常用词根
- 支持在词根详情页智能分析并补充该词根下的常用单词
- 对 AI 返回结果做了结构校验、去重过滤和空结果提示，避免无效数据直接入库

## 数据备份

数据存储在项目根目录的 `./data/words.db` 文件中。

```bash
# 手动备份
cp ./data/words.db ./data/words_backup_$(date +%Y%m%d).db
```

## 本地开发（无 Docker）

```bash
# 先准备环境变量
cp .env.example .env

# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install

# 启动前端开发服务器（带热更新）
npm run dev

# 另一个终端启动后端
cd server && npm run dev
```

## 项目结构

```text
english_word/
├── server/                # 后端
│   ├── index.js           # 入口文件
│   ├── config/            # 数据库配置
│   ├── models/            # Sequelize 模型
│   ├── routes/            # API 路由
│   └── utils/             # 工具函数
├── client/                # 前端
│   ├── src/
│   │   ├── api/           # API 请求封装
│   │   ├── views/         # 页面视图
│   │   ├── router/        # 路由配置
│   │   └── styles/        # 样式文件
│   └── vite.config.js
├── data/                  # SQLite 数据库文件
├── Dockerfile
├── docker-compose.yml
└── README.md
```
