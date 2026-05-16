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

// M009：创建 study_sessions 表，记录每次学习时段
async function m009_create_study_sessions() {
  const tables = await qi.showAllTables().catch(() => []);
  if (tables.includes('study_sessions')) return;
  await qi.createTable('study_sessions', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    started_at: { type: DataTypes.DATE, allowNull: false },
    ended_at: { type: DataTypes.DATE, allowNull: true },
    duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
    note: { type: DataTypes.STRING(100), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  console.log('[migration] M009: study_sessions 表已创建');
}

// M010：为每个用户最多一条 is_default=true 的词根添加唯一部分索引
// SQLite 部分索引确保 DB 层幂等，防止并发竞争产生重复默认词根。
async function m010_roots_unique_default_per_user() {
  try {
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_roots_user_default
       ON roots (user_id) WHERE is_default = 1`
    );
    console.log('[migration] M010: roots 每用户唯一默认词根部分索引已创建');
  } catch (e) {
    // SQLite 3.x 在索引已存在时不会重复抛错（IF NOT EXISTS），
    // 此处兜底忽略 "already exists" 类型报错。
    if (!String(e.message).toLowerCase().includes('already exists')) throw e;
  }
}

// M011：为每个用户最多一条活跃 study_session 添加唯一部分索引（ended_at IS NULL）
// 防止并发 POST /study-sessions/start 创建多条活跃会话。
async function m011_study_sessions_unique_active() {
  try {
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_active
       ON study_sessions (user_id) WHERE ended_at IS NULL`
    );
    console.log('[migration] M011: study_sessions 活跃会话唯一索引已创建');
  } catch (e) {
    if (!String(e.message).toLowerCase().includes('already exists')) throw e;
  }
}

// M012：为 word_reviews 表添加 success_count 列，用于区分尝试次数和成功次数
async function m012_word_reviews_add_success_count() {
  const info = await qi.describeTable('word_reviews').catch(() => ({}));
  if (info.success_count !== undefined || Object.keys(info).length === 0) return;
  await qi.addColumn('word_reviews', 'success_count', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  console.log('[migration] M012: word_reviews.success_count 已添加');
}

// M013：为 word_reviews 表添加 perfect_streak_count 列，用于记录连续 quality=4 次数
async function m013_word_reviews_add_perfect_streak_count() {
  const info = await qi.describeTable('word_reviews').catch(() => ({}));
  if (info.perfect_streak_count !== undefined || Object.keys(info).length === 0) return;
  await qi.addColumn('word_reviews', 'perfect_streak_count', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  console.log('[migration] M013: word_reviews.perfect_streak_count 已添加');
}

// M014：补齐历史单词的复习记录，并清理旧的暂停状态
async function m014_word_reviews_backfill_all_words() {
  const reviewInfo = await qi.describeTable('word_reviews').catch(() => ({}));
  const wordInfo = await qi.describeTable('words').catch(() => ({}));
  if (Object.keys(reviewInfo).length === 0 || Object.keys(wordInfo).length === 0) return;

  const [missingRows] = await sequelize.query(`
    SELECT COUNT(*) AS count
    FROM words
    LEFT JOIN word_reviews
      ON word_reviews.user_id = words.user_id
     AND word_reviews.word_id = words.id
    WHERE words.user_id IS NOT NULL
      AND word_reviews.id IS NULL
  `);
  const missingCount = Number(missingRows?.[0]?.count || 0);

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  await sequelize.query(
    `UPDATE word_reviews
     SET paused = 0
     WHERE paused != 0`
  );

  if (missingCount === 0) {
    console.log('[migration] M014: word_reviews 已覆盖所有历史单词');
    return;
  }

  await sequelize.query(
    `INSERT OR IGNORE INTO word_reviews (
      user_id,
      word_id,
      status,
      interval,
      ease_factor,
      due_date,
      due_at,
      review_count,
      success_count,
      perfect_streak_count,
      paused,
      last_reviewed_at,
      create_time,
      update_time
    )
    SELECT
      words.user_id,
      words.id,
      'new',
      0,
      2.5,
      ?,
      ?,
      0,
      0,
      0,
      0,
      NULL,
      ?,
      ?
    FROM words
    WHERE words.user_id IS NOT NULL`,
    { replacements: [today, now, now, now] }
  );

  console.log(`[migration] M014: 已为 ${missingCount} 个历史单词补齐复习记录`);
}

// M015：为 users 表添加 token_version 列，用于密码变更后撤销旧 JWT
async function m015_users_add_token_version() {
  const info = await qi.describeTable('users').catch(() => ({}));
  if (info.token_version !== undefined || Object.keys(info).length === 0) return;
  await qi.addColumn('users', 'token_version', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
  console.log('[migration] M015: users.token_version 已添加');
}

// M016：为 roots / words 添加每用户唯一索引，避免并发写入重复数据
async function m016_unique_indexes_for_roots_and_words() {
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_roots_user_name_unique
     ON roots (user_id, name COLLATE NOCASE)
     WHERE user_id IS NOT NULL`
  );
  await sequelize.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_words_user_name_unique
     ON words (user_id, name)
     WHERE user_id IS NOT NULL`
  );
  console.log('[migration] M016: roots/words 每用户唯一索引已创建');
}

// M017：创建 user_ai_settings 表，用于加密保存每用户的 AI Key 映射
async function m017_create_user_ai_settings() {
  const tables = await qi.showAllTables().catch(() => []);
  if (tables.includes('user_ai_settings')) return;
  await qi.createTable('user_ai_settings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    encrypted_payload: { type: DataTypes.TEXT, allowNull: false },
    iv: { type: DataTypes.STRING, allowNull: false },
    auth_tag: { type: DataTypes.STRING, allowNull: false },
    create_time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    update_time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  console.log('[migration] M017: user_ai_settings 表已创建');
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
  await m009_create_study_sessions();
  await m010_roots_unique_default_per_user();
  await m011_study_sessions_unique_active();
  await m012_word_reviews_add_success_count();
  await m013_word_reviews_add_perfect_streak_count();
  await m014_word_reviews_backfill_all_words();
  await m015_users_add_token_version();
  await m016_unique_indexes_for_roots_and_words();
  await m017_create_user_ai_settings();
}
