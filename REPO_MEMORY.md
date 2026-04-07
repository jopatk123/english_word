# Repository Memory

这个文件是当前仓库可被 Git 同步的重要协作记忆。项目相关的经验、约定、坑点和测试结论，统一优先记录在这里，不再依赖个人设备上的临时记忆。

## 记忆策略

- 只记录对项目有重要且长期影响的记忆，避免过度记录导致信息冗余和维护成本增加。
- 项目级的重要记忆只记录到本文件，必要时再同步到 Copilot 的仓库级记忆。
- 不把仓库事实写入个人级记忆，避免多设备开发时信息漂移。
- 新增记忆时优先记录可执行事实：文件位置、约定、已验证结论、回归风险、测试命令。
- 过期记忆直接修改本文件，不保留历史版本，避免信息过时导致误导。

## 当前重要记忆

### 仓库结构与职责

- 当前仓库是单仓多包结构：根目录负责协同脚本、代码规范和统一测试入口；client 是 Vue 3 + Vite + Element Plus 前端；server 是 Express + Sequelize + SQLite 后端。
- 生产入口由 server/index.js 统一承载，同一个进程同时提供 /api 和 client/dist 静态资源。
- 根目录 package.json 只维护共享质量工具和聚合命令；业务运行依赖分别安装在 client 和 server。
- docker-compose.yml、Dockerfile 负责容器化部署；start.sh 负责本地一键启动，会检查 3010 端口占用、构建前端并写入 .start-server.pid。

### 关键业务约定

- 认证体系基于 JWT；/api/auth 免认证，其余 /api/\* 默认需要 Bearer token。
- 用户隔离依赖 Root.user_id；前端 token 保存在 localStorage 的 token 键中，请求会自动附带，401 会跳转到 /login。
- AI 设置保存在 localStorage 的 english-word-ai-settings 键中；服务端 /api/ai 负责模型代理、返回结果清洗和结构校验。
- 复习统计的当前口径是：learning = 所有非 known 的已加入单词，known = status === 'known'，total = learning + known。
- /api/review/due 默认只返回当前已到期单词；scope=continue 会把未掌握词优先排在已掌握词之前。
- 数据导出/导入已经支持全量 JSON 备份与幂等导入，前后端都有现成入口，不要再设计平行格式。

### 开发、测试与质量入口

- 根目录测试聚合入口：npm run test、npm run test:coverage。
- 前端测试入口：npm --prefix client run test:run、npm --prefix client run test:coverage。
- 后端测试入口：npm --prefix server test、npm --prefix server run test:coverage。
- 本地开发通常需要分别安装三处依赖：根目录、client、server；根目录主要提供 ESLint 和 Prettier，不承载业务运行时依赖。


