import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 使用内存数据库，避免污染真实数据
    env: {
      DB_PATH: ':memory:',
      // 测试专用管理员密码，与 getAdminPassword() 的 test 分支对齐
      ADMIN_PASSWORD: 'test-admin-password',
    },
    // 保证测试串行执行（共享同一个内存DB）
    singleFork: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['**/*.js'],
      exclude: ['**/node_modules/**', 'test/**'],
    },
  },
});
