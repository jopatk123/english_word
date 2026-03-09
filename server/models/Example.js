import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Example = sequelize.define('Example', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  wordId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'word_id',
    comment: '关联单词ID',
  },
  sentence: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '例句原文',
  },
  translation: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '翻译',
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  tableName: 'examples',
  timestamps: true,
  createdAt: 'create_time',
  updatedAt: 'update_time',
});

export default Example;
