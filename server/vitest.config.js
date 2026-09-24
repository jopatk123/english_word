import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 使用内存数据库，避免污染真实数据
    env: {
      DB_PATH: ':memory:',
      // 管理员口令/JWT 在测试环境使用 env.js 内置安全占位值。
    },
    // 串行执行测试文件（多文件并行时曾出现 supertest 偶发
    // "Parse Error: Expected HTTP/" 导致 CI 间歇性失败）。
    // 注意：Vitest 4 已移除旧版顶层 singleFork 选项（会被静默忽略），
    // 须使用 fileParallelism: false 实现文件级串行。
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['**/*.js'],
      exclude: ['**/node_modules/**', 'test/**'],
    },
  },
});
