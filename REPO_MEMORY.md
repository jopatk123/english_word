# Repository Memory

This file serves as important collaborative memory for this repository that can be synchronized with Git. Project-related experiences, conventions, pitfalls, and testing conclusions are uniformly recorded here first, eliminating reliance on temporary memory stored on personal devices.

## Memory Strategy

- Only record memories that have significant and long-term impact on the project, avoiding excessive recording that leads to information redundancy and increased maintenance costs.
- Project-level important memories are recorded only in this file, and synced to Copilot's repository-level memory when necessary.
- Do not write repository facts into personal-level memory to avoid information drift across multiple devices.
- When adding new memories, prioritize recording executable facts: file locations, conventions, validated conclusions, regression risks, and test commands.
- Modify expired memories directly in this file without keeping historical versions, avoiding misinformation caused by outdated information.

## Current Important Memories

### Repository Structure and Responsibilities

- The current repository uses a monorepo multi-package structure: the root directory handles collaborative scripts, code standards, and unified test entry; `client` is the Vue 3 + Vite + Element Plus frontend; `server` is the Express + Sequelize + SQLite backend.
- The production entry is uniformly handled by `server/index.js`, with the same process serving both `/api` and `client/dist` static resources.
- The root `package.json` only maintains shared quality tools and aggregate commands; business runtime dependencies are installed in `client` and `server` respectively.
- `docker-compose.yml` and `Dockerfile` handle containerized deployment; `start.sh` handles one-click local startup, checking port 3010 usage, building the frontend, and writing `.start-server.pid`.

### Key Business Conventions

- Authentication is based on JWT; `/api/auth` is unauthenticated, all other `/api/*` endpoints require a Bearer token by default.
- User isolation relies on `Root.user_id`; the frontend token is stored in `localStorage` under the key `token`, automatically attached to requests, and 401 responses trigger a redirect to `/login`.
- AI settings are stored in `localStorage` under the key `english-word-ai-settings`; the server-side `/api/ai` handles model proxying, response cleaning, and structure validation.
- The current review statistics definition: `learning` = all added words not marked `known`; `known` = words with status `'known'`; `total` = `learning` + `known`.
- `/api/review/due` by default returns only words that are currently due; with `scope=continue`, non-mastered words are prioritized before mastered words.
- Data export/import already supports full JSON backup and idempotent import, with existing endpoints on both frontend and backend; do not design parallel formats.

### Development, Testing, and Quality Entry Points

- Root test aggregation entry: `npm run test`, `npm run test:coverage`.
- Frontend test entry: `npm --prefix client run test:run`, `npm --prefix client run test:coverage`.
- Backend test entry: `npm --prefix server test`, `npm --prefix server run test:coverage`.
- Local development typically requires installing dependencies in three places: root, `client`, and `server`; the root mainly provides ESLint and Prettier and does not host business runtime dependencies.