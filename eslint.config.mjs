import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';
import { builtinRules } from 'eslint/use-at-your-own-risk';

/** 公共宽松规则（warn 级别，不阻断开发） */
const looseRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console': 'off',
  'no-debugger': 'warn',
  'no-undef': 'error',
};

// ── 文件体量控制（见 AGENTS.md）────────────────────────────
// 限制有效行数（跳过空行与注释）：600 行预警、800 行直接报错（阻断 CI）。
// 同一条规则在同名文件里只能有一个阈值，因此把核心 max-lines 复制为
// local/max-lines-hard 承担 800 行的硬上限，核心规则保留 600 行预警。
const MAX_LINES_WARN = 600;
const MAX_LINES_ERROR = 800;
const maxLinesOptions = { skipBlankLines: true, skipComments: true };

const sizeRules = {
  'max-lines': ['warn', { max: MAX_LINES_WARN, ...maxLinesOptions }],
  'local/max-lines-hard': ['error', { max: MAX_LINES_ERROR, ...maxLinesOptions }],
};

const sizePlugin = {
  rules: {
    'max-lines-hard': builtinRules.get('max-lines'),
  },
};

export default [
  // ── 忽略目录 ──────────────────────────────────────────────
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'data/**'],
  },

  // ── 服务端 JS（Node ESM）──────────────────────────────────
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      ...looseRules,
    },
  },

  // ── 客户端根目录配置（Vite/Vitest）────────────────────────
  {
    files: ['client/*.js'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      ...looseRules,
    },
  },

  // ── 客户端 JS（浏览器 ESM）───────────────────────────────
  {
    files: ['client/src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      ...looseRules,
    },
  },

  // ── Vue 3 单文件组件（使用 flat/essential 宽松集）────────
  ...pluginVue.configs['flat/essential'],
  {
    files: ['client/src/**/*.vue'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...looseRules,
      'vue/multi-word-component-names': 'off', // 常见单词命名的组件（如 HomeView）
      'vue/no-mutating-props': 'warn', // 宽松：降为警告，修复需要重构组件 emit API
      'vue/no-unused-vars': 'warn',
      'vue/html-self-closing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off',
    },
  },

  // ── Vitest 测试文件（客户端 + 服务端）────────────────────
  {
    files: ['client/src/**/__tests__/**/*.{js,spec.js}', 'server/test/**/*.{js,test.js}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.vitest },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ── 文件体量控制（全量 JS/Vue 文件）──────────────────────
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    plugins: { local: sizePlugin },
    rules: sizeRules,
  },

  // ── 关闭与 Prettier 冲突的格式类规则 ────────────────────
  prettierConfig,
];
