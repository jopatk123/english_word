import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Word = sequelize.define('Word', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  rootId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'root_id',
    comment: '关联词根ID',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '单词',
  },
  meaning: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '含义',
  },
  phonetic: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '音标',
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注',
  },
}, {
  tableName: 'words',
  timestamps: true,
  createdAt: 'create_time',
  updatedAt: 'update_time',
});

export default Word;
