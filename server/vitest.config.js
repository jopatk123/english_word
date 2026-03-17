import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 使用内存数据库，避免污染真实数据
    env: {
      DB_PATH: ':memory:',
    },
    // 保证测试串行执行（共享同一个内存DB）
    singleFork: true,
  },
});
