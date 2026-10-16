import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Passage = sequelize.define(
  'Passage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      comment: '所属用户 ID',
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
      comment: '标题',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '英文正文（段落以空行分隔）',
    },
    level: {
      type: DataTypes.STRING(4),
      allowNull: true,
      comment: '难度：A1/A2/B1/B2/C1/C2',
    },
    source: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'manual',
      comment: '来源：manual / ai',
    },
    topic: {
      type: DataTypes.STRING(60),
      allowNull: true,
      comment: 'AI 生成时的主题',
    },
    wordCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'word_count',
      comment: '英文单词数',
    },
    sentenceCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sentence_count',
      comment: '句子数',
    },
  },
  {
    tableName: 'passages',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
    indexes: [{ name: 'idx_passages_user_update', fields: ['user_id', 'update_time'] }],
  }
);

export default Passage;
