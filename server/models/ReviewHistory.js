import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ReviewHistory = sequelize.define(
  'ReviewHistory',
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
    },
    wordId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'word_id',
    },
    quality: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '评分: 1=again, 2=hard, 3=good, 4=easy',
    },
    intervalBefore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'interval_before',
      comment: '复习前的间隔',
    },
    intervalAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'interval_after',
      comment: '复习后的间隔',
    },
    easeFactorBefore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'ease_factor_before',
    },
    easeFactorAfter: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'ease_factor_after',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'reviewed_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'review_histories',
    timestamps: false,
    indexes: [{ fields: ['user_id', 'reviewed_at'] }, { fields: ['user_id', 'word_id'] }],
  }
);

export default ReviewHistory;
