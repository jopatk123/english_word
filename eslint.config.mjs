import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'

/** 公共宽松规则（warn 级别，不阻断开发） */
const looseRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console': 'off',
  'no-debugger': 'warn',
  'no-undef': 'error',
}

export default [
  // ── 忽略目录 ──────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'data/**',
    ],
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
      'vue/multi-word-component-names': 'off',  // 常见单词命名的组件（如 HomeView）
      'vue/no-mutating-props': 'warn',  // 宽松：降为警告，修复需要重构组件 emit API
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

  // ── 关闭与 Prettier 冲突的格式类规则 ────────────────────
  prettierConfig,
]
