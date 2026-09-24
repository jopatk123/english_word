import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

/** 公共宽松规则（warn 级别，不阻断开发） */
const looseRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console': 'off',
  'no-debugger': 'warn',
  'no-undef': 'error',
};

// ── 文件体量控制（见 AGENTS.md）────────────────────────────
// 限制有效行数（跳过空行与注释）：800 行预警、1000 行直接报错（阻断 CI）。
// 同一条规则在同名文件里只能有一个阈值，因此把核心 max-lines 复制为
// local/max-lines-hard 承担 1000 行的硬上限，核心规则保留 800 行预警。
const MAX_LINES_WARN = 800;
const MAX_LINES_ERROR = 1000;
const maxLinesOptions = { skipBlankLines: true, skipComments: true };

const sizeRules = {
  'max-lines': ['warn', { max: MAX_LINES_WARN, ...maxLinesOptions }],
  'local/max-lines-hard': ['error', { max: MAX_LINES_ERROR, ...maxLinesOptions }],
};

const sizePlugin = {
  rules: {
    // 内建 max-lines 的本地复刻：同名规则无法配置两个阈值，
    // 故由本规则承担硬上限（error），核心 max-lines 保留预警（warn）。
    // 不再依赖已弃用的 eslint/use-at-your-own-risk 的 builtinRules。
    'max-lines-hard': {
      meta: {
        schema: [
          {
            type: 'object',
            properties: {
              max: { type: 'integer', minimum: 0 },
              skipComments: { type: 'boolean' },
              skipBlankLines: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          exceed: 'File has too many lines ({{actual}}). Maximum allowed is {{max}}.',
        },
      },
      create(context) {
        const option = context.options[0];
        let max = 300;

        if (typeof option === 'object' && Object.hasOwn(option, 'max')) {
          max = option.max;
        } else if (typeof option === 'number') {
          max = option;
        }

        const skipComments = option && option.skipComments;
        const skipBlankLines = option && option.skipBlankLines;
        const sourceCode = context.sourceCode;

        const isCommentNodeType = (token) =>
          token && (token.type === 'Block' || token.type === 'Line');

        // 返回注释中「所在行没有任何代码」的行号（即纯注释行，不含行内注释）
        function getLinesWithoutCode(comment) {
          let start = comment.loc.start.line;
          let end = comment.loc.end.line;

          let token = comment;
          do {
            token = sourceCode.getTokenBefore(token, { includeComments: true });
          } while (isCommentNodeType(token));

          if (token && token.loc.end.line === comment.loc.start.line) {
            start += 1;
          }

          token = comment;
          do {
            token = sourceCode.getTokenAfter(token, { includeComments: true });
          } while (isCommentNodeType(token));

          if (token && comment.loc.end.line === token.loc.start.line) {
            end -= 1;
          }

          if (start <= end) {
            const result = [];
            for (let i = start; i <= end; i++) result.push(i);
            return result;
          }
          return [];
        }

        return {
          'Program:exit'() {
            let lines = sourceCode.lines.map((text, i) => ({ lineNumber: i + 1, text }));

            // 文件以换行符结尾时 lines 会多出一个空行，不算真实行
            if (lines.length > 1 && lines.at(-1).text === '') {
              lines.pop();
            }

            if (skipBlankLines) {
              lines = lines.filter((l) => l.text.trim() !== '');
            }

            if (skipComments) {
              const commentLines = new Set(
                sourceCode.getAllComments().flatMap(getLinesWithoutCode)
              );
              lines = lines.filter((l) => !commentLines.has(l.lineNumber));
            }

            if (lines.length > max) {
              context.report({
                loc: {
                  start: { line: lines[max].lineNumber, column: 0 },
                  end: {
                    line: sourceCode.lines.length,
                    column: sourceCode.lines.at(-1).length,
                  },
                },
                messageId: 'exceed',
                data: { max, actual: lines.length },
              });
            }
          },
        };
      },
    },
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
