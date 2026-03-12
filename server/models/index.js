import sequelize from '../config/database.js';
import User from './User.js';
import Root from './Root.js';
import Word from './Word.js';
import Example from './Example.js';
import WordReview from './WordReview.js';

// 用户 -> 词根 (一对多)
User.hasMany(Root, { foreignKey: 'user_id', as: 'roots', onDelete: 'CASCADE' });
Root.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 词根 -> 单词 (一对多)
Root.hasMany(Word, { foreignKey: 'root_id', as: 'words', onDelete: 'CASCADE' });
Word.belongsTo(Root, { foreignKey: 'root_id', as: 'root' });

// 单词 -> 例句 (一对多)
Word.hasMany(Example, { foreignKey: 'word_id', as: 'examples', onDelete: 'CASCADE' });
Example.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

// 用户 -> 学习记录 (一对多)
User.hasMany(WordReview, { foreignKey: 'user_id', as: 'reviews', onDelete: 'CASCADE' });
WordReview.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 单词 -> 学习记录 (一对多)
Word.hasMany(WordReview, { foreignKey: 'word_id', as: 'reviews', onDelete: 'CASCADE' });
WordReview.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

const initDB = async () => {
  await sequelize.sync();

  // 迁移：为 roots 表添加 user_id 列（如果不存在）
  const queryInterface = sequelize.getQueryInterface();
  const tableInfo = await queryInterface.describeTable('roots').catch(() => ({}));
  if (!tableInfo.user_id) {
    await queryInterface.addColumn('roots', 'user_id', {
      type: sequelize.constructor.DataTypes.INTEGER,
      allowNull: true,
    });
    console.log('已为 roots 表添加 user_id 列');
  }

  console.log('数据库同步完成');
};

export { sequelize, User, Root, Word, Example, WordReview, initDB };
