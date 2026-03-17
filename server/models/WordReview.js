import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WordReview = sequelize.define('WordReview', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    comment: '关联用户ID',
  },
  wordId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'word_id',
    comment: '关联单词ID',
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'new',
    comment: '学习状态: new/learning/review/known',
  },
  interval: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '下次复习间隔（天）',
  },
  easeFactor: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 2.5,
    field: 'ease_factor',
    comment: '难度系数',
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'due_date',
    comment: '下次应复习日期',
  },
  reviewCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'review_count',
    comment: '累计复习次数',
  },
  lastReviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_reviewed_at',
    comment: '最近一次复习时间',
  },
  paused: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否暂停学习',
  },
}, {
  tableName: 'word_reviews',
  timestamps: true,
  createdAt: 'create_time',
  updatedAt: 'update_time',
  indexes: [
    { unique: true, fields: ['user_id', 'word_id'] },
    { fields: ['user_id', 'due_date'] },
    { fields: ['user_id', 'status'] },
  ],
});

export default WordReview;
