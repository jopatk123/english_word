import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PassageReview = sequelize.define(
  'PassageReview',
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
    passageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'passage_id',
      comment: '短文 ID',
      references: { model: 'passages', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    stage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '重读间隔档位下标',
    },
    readCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'read_count',
      comment: '累计读完次数',
    },
    lastRating: {
      type: DataTypes.STRING(8),
      allowNull: true,
      field: 'last_rating',
      comment: '最近一次自评：hard / good / easy',
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_read_at',
      comment: '最近一次读完时间',
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'due_date',
      comment: '下次重读日期',
    },
  },
  {
    tableName: 'passage_reviews',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
    indexes: [
      {
        name: 'idx_passage_reviews_user_passage_unique',
        unique: true,
        fields: ['user_id', 'passage_id'],
      },
      { name: 'idx_passage_reviews_user_due', fields: ['user_id', 'due_date'] },
    ],
  }
);

export default PassageReview;
