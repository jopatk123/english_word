import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WordRoot = sequelize.define('WordRoot', {
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
  rootId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'root_id',
    comment: '关联词根ID',
  },
}, {
  tableName: 'word_roots',
  timestamps: true,
  createdAt: 'create_time',
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['word_id', 'root_id'] },
  ],
});

export default WordRoot;
