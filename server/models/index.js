import sequelize from '../config/database.js';
import Root from './Root.js';
import Word from './Word.js';
import Example from './Example.js';

// 词根 -> 单词 (一对多)
Root.hasMany(Word, { foreignKey: 'root_id', as: 'words', onDelete: 'CASCADE' });
Word.belongsTo(Root, { foreignKey: 'root_id', as: 'root' });

// 单词 -> 例句 (一对多)
Word.hasMany(Example, { foreignKey: 'word_id', as: 'examples', onDelete: 'CASCADE' });
Example.belongsTo(Word, { foreignKey: 'word_id', as: 'word' });

const initDB = async () => {
  await sequelize.sync();
  console.log('数据库同步完成');
};

export { sequelize, Root, Word, Example, initDB };
