import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WordRoot = sequelize.define(
  'WordRoot',
  {
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
      references: { model: 'words', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    rootId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'root_id',
      comment: '关联词根ID',
      references: { model: 'roots', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  },
  {
    tableName: 'word_roots',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: false,
    indexes: [{ name: 'word_roots_word_id_root_id', unique: true, fields: ['word_id', 'root_id'] }],
  }
);

export default WordRoot;
