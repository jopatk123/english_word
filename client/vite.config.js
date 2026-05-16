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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('node_modules/element-plus')) {
            return 'element-plus';
          }

          if (id.includes('echarts')) {
            return 'echarts';
          }

          if (id.includes('vue')) {
            return 'vue-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});
