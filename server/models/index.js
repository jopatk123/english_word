import sequelize from '../config/database.js';
import { runMigrations } from '../migrations.js';
import User from './User.js';
import Root from './Root.js';
import Word from './Word.js';
import WordRoot from './WordRoot.js';
import Example from './Example.js';
import WordReview from './WordReview.js';
import ReviewHistory from './ReviewHistory.js';
import StudySession from './StudySession.js';

// 用户 -> 词根 (一对多)
User.hasMany(Root, { foreignKey: 'user_id', as: 'roots', onDelete: 'CASCADE' });
Root.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 -> 单词 (一对多)
User.hasMany(Word, { foreignKey: 'user_id', as: 'words', onDelete: 'CASCADE' });
Word.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 词根 <-> 单词 (多对多，通过 word_roots 关联表)
Word.belongsToMany(Root, {
  through: WordRoot,
  foreignKey: 'wordId',
  otherKey: 'rootId',
  as: 'roots',
});
Root.belongsToMany(Word, {
  through: WordRoot,
  foreignKey: 'rootId',
  otherKey: 'wordId',
  as: 'words',
});

// WordRoot 直接关联（用于独立查询关联表）
WordRoot.belongsTo(Root, { foreignKey: 'root_id', as: 'root' });
WordRoot.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

// 单词 -> 例句 (一对多)
Word.hasMany(Example, { foreignKey: 'word_id', as: 'examples', onDelete: 'CASCADE' });
Example.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

// 用户 -> 学习记录 (一对多)
User.hasMany(WordReview, { foreignKey: 'user_id', as: 'reviews', onDelete: 'CASCADE' });
WordReview.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 单词 -> 学习记录 (一对多)
Word.hasMany(WordReview, { foreignKey: 'word_id', as: 'reviews', onDelete: 'CASCADE' });
WordReview.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

// 用户 -> 学习历史 (一对多)
User.hasMany(ReviewHistory, { foreignKey: 'user_id', as: 'reviewHistories', onDelete: 'CASCADE' });
ReviewHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 单词 -> 学习历史 (一对多)
Word.hasMany(ReviewHistory, { foreignKey: 'word_id', as: 'reviewHistories', onDelete: 'CASCADE' });
ReviewHistory.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

// 用户 -> 学习计时记录 (一对多)
User.hasMany(StudySession, { foreignKey: 'user_id', as: 'studySessions', onDelete: 'CASCADE' });
StudySession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

const initDB = async () => {
  const qi = sequelize.getQueryInterface();
  const existingTables = await qi.showAllTables().catch(() => []);
  const hasAppTables = Array.isArray(existingTables)
    ? existingTables.some((name) => ['users', 'words', 'roots', 'word_reviews'].includes(name))
    : false;

  if (hasAppTables) {
    await runMigrations();
    await sequelize.sync();
  } else {
    await sequelize.sync();
    await runMigrations();
  }

  console.log('数据库同步完成');
};

export { sequelize, User, Root, Word, WordRoot, Example, WordReview, ReviewHistory, StudySession, initDB };
