# 📖 词根背单词工具

基于词根记忆法的多用户英语学习工具，包含词根/单词/例句管理、SRS 复习、学习计时、AI 辅助和超级管理员后台。前端构建产物由 Express 统一托管，API 与页面共用同一个服务入口。

## 功能概览

- 用户注册、登录与多用户数据隔离
- 词根、单词、例句的增删改查，自动维护“未分类”默认词根
- 首页搜索，支持按词根/单词名称和含义模糊匹配，单词结果可自动朗读
- 背单词系统：今日到期、超期、学习中、已掌握、继续学习等视图与学习报表
- 学习计时：服务端权威状态、WebSocket 实时同步、统计与导出
- AI 辅助：词根建议、单词建议、例句建议、单词分析、句子分析、模型自动发现、思考模型自动禁用思考
- AI 密钥安全：各厂商 API Key 以加密形式保存到服务端，浏览器仅保留非敏感偏好配置
- 用户 API Token：可创建/列出/撤销不透明 Token（`ewt_` 前缀），供脚本或 Agent 访问普通业务 API
- 全量数据导出/导入：导入时若目标账号尚未拥有“未分类”默认词根，会自动创建后再恢复关联
- 超级管理员后台：前端路由为 `/super-admin`，可查看用户、重置密码、启停账号、删除用户

## 技术栈

- 后端：Node.js 20.17+、Express、Sequelize、SQLite、ws
- 前端：Vue 3、Vite、Element Plus、ECharts
- 测试：Vitest、Supertest
- 部署：Docker、Docker Compose

## 运行架构

- HTTP 页面与 API 由同一个 Express 服务提供
- 用户接口统一挂在 `/api/*`
- 用户 API Token 管理接口挂在 `/api/api-tokens`
- 超级管理员接口挂在 `/api/admin/*`
- 公开健康检查接口 `/api/health`，供本地启动脚本和容器探活使用
- 学习计时实时通道为 `/ws/study-timer`
- 生产环境前端静态资源来自 `client/dist`

## 部署前必读

- `PORT`、`DB_PATH`、`JWT_SECRET`、`AI_SETTINGS_SECRET`、`API_TOKEN_PEPPER`、`ADMIN_JWT_SECRET`、`ADMIN_PASSWORD_HASH` 全部必填
- 项目已移除运行时和 Docker 部署层的默认值；任一变量缺失或为空，部署会直接失败
- 管理员登录密码只以 bcrypt 哈希形式配置，不再支持明文环境变量
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
AI_SETTINGS_SECRET=replace-with-another-long-random-secret
API_TOKEN_PEPPER=replace-with-another-long-random-secret
ADMIN_JWT_SECRET=replace-with-another-long-random-secret
ADMIN_PASSWORD_HASH=replace-with-bcrypt-hash
```

如果任一变量为空，`docker compose build` 或 `docker compose up` 会直接失败，而不会再使用默认值继续启动。

可使用项目后端依赖生成管理员密码哈希：

```bash
npm --prefix server install
cd server && node -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('your-admin-password', 12));"
```

**重要提示**：bcrypt 哈希中包含 `$` 字符。在 Docker Compose `.env` 文件中，每个 `$` 必须转义为 `$$`，否则 Docker Compose 会误将其解释为变量插值，导致哈希损坏、登录失败。

示例：生成的哈希为 `$2a$12$AbCd...`，在 `.env` 中需写为：

```env
ADMIN_PASSWORD_HASH=$$2a$$12$$AbCd...
```

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

请使用 Node.js 20.17 或更高版本；后端 SQLite 依赖需要该运行时版本。

### 1. 准备 `.env`

```bash
cp .env.example .env
```

按本地开发方式填写，例如：

```env
PORT=3010
DB_PATH=./data/words.dev.db
JWT_SECRET=replace-with-a-long-random-secret
AI_SETTINGS_SECRET=replace-with-another-long-random-secret
API_TOKEN_PEPPER=replace-with-another-long-random-secret
ADMIN_JWT_SECRET=replace-with-another-long-random-secret
ADMIN_PASSWORD_HASH=replace-with-bcrypt-hash
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

### 代码规范约束

- ESLint 限制单文件体量（有效行数，跳过空行与注释）：超过 **600 行** 报 warning，超过 **800 行** 报 error（会阻断 CI）
- 超过 800 行的文件需要拆分后再提交

## 环境变量说明

| 变量名                | 是否必填 | 说明                                                                                               |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `PORT`                | 是       | 服务监听端口；Docker 对外映射也使用同一个端口                                                      |
| `DB_PATH`             | 是       | SQLite 文件路径；Docker 建议 `/app/data/words.db`，本地建议 `./data/words.dev.db`                  |
| `JWT_SECRET`          | 是       | 普通用户登录 JWT 的签名密钥                                                                        |
| `AI_SETTINGS_SECRET`  | 是       | 服务端加密保存 AI Key 的独立密钥，建议与 `JWT_SECRET` 不同                                         |
| `API_TOKEN_PEPPER`    | 是       | 用户 API Token 的 HMAC pepper，必须与 `JWT_SECRET` 不同；改密或轮换 JWT 密钥不会撤销已有 API Token |
| `ADMIN_JWT_SECRET`    | 是       | 超级管理员 token 的签名密钥，必须与 `JWT_SECRET` 不同                                              |
| `ADMIN_PASSWORD_HASH` | 是       | 超级管理员登录密码的 bcrypt 哈希，对应页面为 `/super-admin`                                        |
| `ALLOWED_ORIGINS`     | 否       | 允许跨域的来源白名单（逗号分隔）；留空表示仅允许同源请求                                           |
| `TRUST_PROXY`         | 否       | 反向代理层数，决定 Express 如何解析客户端真实 IP；未设置时生产环境默认 `1`，其他环境 `false`       |

### 反向代理与限流（`TRUST_PROXY`）

登录、管理员登录、AI 接口按客户端 IP 限流。若服务部署在 Nginx 等反向代理之后，必须让 Express 信任代理，否则所有请求的 `req.ip` 都会是代理地址，导致全站共用一个限流桶：

- 未设置 `TRUST_PROXY` 时：`NODE_ENV=production`（Docker 镜像已默认设置）按「信任一层代理」处理，本地开发/测试环境不信任任何代理头
- 服务**直接暴露公网**（无反向代理）时必须显式设置 `TRUST_PROXY=false`，否则客户端可伪造 `X-Forwarded-For` 绕过限流
- 多级代理（如 CDN + Nginx）按实际跳数设置，如 `TRUST_PROXY=2`

Docker 部署时该变量由 `docker-compose.yml` 透传，默认值为 `1`。

除 IP 维度外，登录接口还有一层**账号维度**的失败限流：同一用户名 10 分钟内失败超过 10 次即返回 429（登录成功不计入），用于防止攻击者用大量代理 IP 对单个账号撞库。

### 错误响应格式

所有未捕获异常统一返回 JSON，不再返回 HTML 错误页：

- 4xx：仅回传显式标记可暴露的提示（如 CORS 拒绝、请求体解析失败），其余返回「请求失败」
- 5xx：返回 `{"code":500,"msg":"服务器内部错误"}`，完整堆栈只写入服务端日志

各路由的 `catch` 分支统一走 `handleRouteError`：带 4xx 状态码的业务错误（如参数校验失败）会回传原始提示，其余异常（数据库报错、运行时错误等）折叠为通用文案并写入日志，避免通过接口泄漏内部细节。

## 运维审计命令

```bash
# 只读检查历史数据是否存在跨用户单词/词根关联或孤立关联记录
npm --prefix server run audit:data-isolation
```

该命令会输出 JSON；若发现 `ownerlessWords`、`crossUserWordRoots` 或 `orphanWordRoots` 非空，会以非 0 状态退出，需先人工拆分或清理历史数据。

## AI 配置说明

AI 配置页（`/ai/settings`）支持多厂商切换、模型选择与温度调节。配置分为服务端存储与浏览器本地存储两部分：

- **服务端加密存储**：各厂商 API Key 使用 `AI_SETTINGS_SECRET` 加密后保存到数据库，浏览器仅持有掩码摘要，密钥明文不落 localStorage。
- **浏览器本地存储**：厂商选择、Base URL、模型、温度、自动拉取的模型列表与手动添加的自定义模型等非敏感偏好，按厂商独立保存于 localStorage。
- **Base URL 限制**：出于 SSRF 防护，服务端拒绝 localhost 与局域网地址；自定义厂商需填写公网可访问的 OpenAI 兼容 API 地址。

## 用户 API Token

登录后可在 `/settings/api-tokens`（顶栏「Token」或 AI 配置页入口）创建个人 API Token：

- 明文格式为 `ewt_` + 64 位十六进制，只在创建时显示一次
- 列表只展示前缀与元数据（名称、创建时间、最后使用、过期时间）
- 请求普通业务 API 时使用 `Authorization: Bearer ewt_…`，权限与该用户登录 JWT 相同
- 不能访问 `/api/admin/*`，也不能用 API Token 再创建/列出/撤销 Token（管理接口只接受登录 JWT）
- 管理员修改用户密码或轮换 `JWT_SECRET` 不会撤销 API Token；轮换 `API_TOKEN_PEPPER` 会使已有 Token 全部失效
- 学习计时 WebSocket 仍只接受登录 JWT，v1 不支持用 API Token 建立实时连接

示例：

```bash
curl -H "Authorization: Bearer ewt_your_token" http://localhost:3010/api/roots
```

### 模型自动获取

内置厂商不再写死模型列表（模型会过期，写死无法跟上厂商更新）。改为：

1. 选择厂商并填写 Base URL 与 API Key 后，组件挂载、厂商切换、Base URL / API Key 输入框失焦（500ms 防抖）时会**静默**调用厂商 `/models` 端点拉取可用模型，写入"自动获取的模型"分组；若当前尚未选择模型，会自动选中列表中的第一个。
2. 也可点击"自动获取模型"按钮**显式**拉取，在对话框中勾选需要导入的模型（写入"自定义模型"分组，可单独删除）。
3. 手动"+ 新增模型"时，若输入的模型不在自动获取列表中，会弹确认警告（模型可能已过期或拼写有误），用户确认后才保存。
4. 已选模型若不在任何列表中（如厂商下架后旧配置仍保留），下拉框会以"未匹配"选项单独显示，避免看不到当前值。

### 思考模型自动禁用思考

翻译与单词分析属于简单任务，不需要推理链。部分模型（DeepSeek-Reasoner/R1/V4 系列（含 V4-Flash/V4-Pro）、Qwen3/QwQ、OpenAI o1/o3/o4/gpt-5、Claude 3.7+/4/4.5、GLM-Z1/4.5/4.6、Kimi-K1/K2、Doubao-Seed 等）会产生隐藏的 reasoning tokens，导致响应慢、token 浪费。后端识别到思考模型时会自动按厂商注入禁用参数，无需用户配置：

| 厂商 / 模型                                      | 禁用参数                         |
| ------------------------------------------------ | -------------------------------- |
| DeepSeek / GLM / Kimi / 豆包 / Claude 3.7+/4/4.5 | `thinking: { type: "disabled" }` |
| DashScope Qwen3 系列                             | `enable_thinking: false`         |
| OpenAI o1/o3/o4 / gpt-5                          | `reasoning_effort: "low"`        |
| Claude 4.6+                                      | 不注入（已废弃，传了会 400）     |

非思考模型不受影响。此外思考模型的 reasoning tokens 计入 `max_tokens` 输出额度，后端对思考模型自动放宽输出上限（1800 → 8192），兜底应对个别不支持禁用思考的模型。

## 项目结构

```text
english_word/
├── client/
│   ├── src/
│   │   ├── api/                # 前端 API 封装
│   │   ├── components/         # 组件（含 admin、study、AI 配置等）
│   │   ├── composables/        # 组合式逻辑（自动拉取模型、学习会话等）
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
