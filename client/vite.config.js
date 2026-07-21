import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3010',
      '/ws': {
        target: 'ws://localhost:3010',
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
  build: {
    // 注意：自定义 manualChunks 把 axios 等依赖强行分到 vendor chunk 时，
    // 会与 entry（src/api/index.js）所在的 api chunk 形成循环依赖：
    //   api chunk 导入 vendor 的 bind 工具 → vendor 反向导入 api 的某些 axios helper
    // 加载顺序无法保证时，vendor 中调用尚未初始化的 helper 会抛
    // "TypeError: e is not a function"，导致 Vue 应用初始化失败、页面白屏。
    // 因此交给 Vite 自动分块，避免人为引入循环依赖。
    chunkSizeWarningLimit: 1500,
  },
});
