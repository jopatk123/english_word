/**
 * 数据库迁移脚本（按执行顺序排列，每次迁移都是幂等的）
 *
 * 命名约定：
 *   migrate_<序号>_<简短描述>(sequelize) — 每个函数只做一件事，互相独立。
 *   迁移检查：先 describeTable，列存在则跳过。
 */

import sequelize from './config/database.js';

const qi = sequelize.getQueryInterface();
const { DataTypes } = sequelize.constructor;

// M001：为 roots 表添加 user_id 列
async function m001_roots_add_user_id() {
  const info = await qi.describeTable('roots').catch(() => ({}));
  if (info.user_id) return;
  await qi.addColumn('roots', 'user_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
  console.log('[migration] M001: roots.user_id 已添加');
}

// M002：为 roots 表添加 is_default 列
async function m002_roots_add_is_default() {
  const info = await qi.describeTable('roots').catch(() => ({}));
  if (info.is_default) return;
  await qi.addColumn('roots', 'is_default', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
  console.log('[migration] M002: roots.is_default 已添加');
}

// M003：为 word_reviews 表添加 paused 列
async function m003_word_reviews_add_paused() {
  const info = await qi.describeTable('word_reviews').catch(() => ({}));
  if (info.paused !== undefined || Object.keys(info).length === 0) return;
  await qi.addColumn('word_reviews', 'paused', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
  console.log('[migration] M003: word_reviews.paused 已添加');
}

// M004：将 words.root_id（一对多）迁移到 word_roots 多对多关联表
async function m004_words_migrate_root_id_to_word_roots() {
  const info = await qi.describeTable('words').catch(() => ({}));
  if (!info.root_id) return;
  const [rows] = await sequelize.query('SELECT id, root_id FROM words WHERE root_id IS NOT NULL');
  for (const row of rows) {
    await sequelize.query(
      'INSERT OR IGNORE INTO word_roots (word_id, root_id, create_time) VALUES (?, ?, ?)',
      { replacements: [row.id, row.root_id, new Date().toISOString()] }
    );
  }
  await sequelize.query('ALTER TABLE words DROP COLUMN root_id');
  console.log('[migration] M004: words.root_id → word_roots 迁移完成');
}

// M005：为 words 表添加 user_id 列，并从 word_roots→roots 回填
async function m005_words_add_user_id() {
  const info = await qi.describeTable('words').catch(() => ({}));
  if (info.user_id) return;
  await qi.addColumn('words', 'user_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
  // 回填：取该单词第一个关联词根的 user_id
  await sequelize.query(`
    UPDATE words
    SET user_id = (
      SELECT roots.user_id
      FROM word_roots
      JOIN roots ON roots.id = word_roots.root_id
      WHERE word_roots.word_id = words.id
      LIMIT 1
    )
    WHERE user_id IS NULL
  `);
  console.log('[migration] M005: words.user_id 已添加并回填');
}

// M006：补齐历史遗留的 words.user_id 空值（仅处理能唯一推断所属用户的数据）
async function m006_words_backfill_missing_user_id() {
  const info = await qi.describeTable('words').catch(() => ({}));
  if (!info.user_id) return;

  await sequelize.query(`
    UPDATE words
    SET user_id = (
      SELECT MIN(roots.user_id)
      FROM word_roots
      JOIN roots ON roots.id = word_roots.root_id
      WHERE word_roots.word_id = words.id
      GROUP BY word_roots.word_id
      HAVING COUNT(DISTINCT roots.user_id) = 1
    )
    WHERE user_id IS NULL
  `);

  const [ambiguousRows] = await sequelize.query(`
    SELECT word_roots.word_id AS wordId
    FROM word_roots
    JOIN roots ON roots.id = word_roots.root_id
    JOIN words ON words.id = word_roots.word_id
    WHERE words.user_id IS NULL
    GROUP BY word_roots.word_id
    HAVING COUNT(DISTINCT roots.user_id) > 1
  `);

  if (ambiguousRows.length) {
    console.warn(
      `[migration] M006: 发现 ${ambiguousRows.length} 个跨用户共享的历史单词记录，需人工核查并拆分`
    );
  }

  console.log('[migration] M006: 已回填可安全推断的 words.user_id');
}

// M007：为 users 表添加 is_disabled 列
async function m007_users_add_is_disabled() {
  const info = await qi.describeTable('users').catch(() => ({}));
  if (info.is_disabled !== undefined || Object.keys(info).length === 0) return;
  await qi.addColumn('users', 'is_disabled', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
  console.log('[migration] M007: users.is_disabled 已添加');
}

// M008：为 word_reviews 表添加 due_at 列，用于分钟/小时级复习调度
async function m008_word_reviews_add_due_at() {
  const info = await qi.describeTable('word_reviews').catch(() => ({}));
  if (info.due_at !== undefined || Object.keys(info).length === 0) return;
  await qi.addColumn('word_reviews', 'due_at', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  console.log('[migration] M008: word_reviews.due_at 已添加');
}

/**
 * 按顺序执行所有迁移。每个迁移函数都是幂等的，可以安全重复运行。
 */
export async function runMigrations() {
  await m001_roots_add_user_id();
  await m002_roots_add_is_default();
  await m003_word_reviews_add_paused();
  await m004_words_migrate_root_id_to_word_roots();
  await m005_words_add_user_id();
  await m006_words_backfill_missing_user_id();
  await m007_users_add_is_disabled();
  await m008_word_reviews_add_due_at();
}
