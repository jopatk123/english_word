import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StudySession = sequelize.define(
  'StudySession',
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
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'started_at',
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ended_at',
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'duration_seconds',
      comment: '本次学习时长（秒），停止时写入',
    },
    note: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '备注标签，用户可选填',
    },
  },
  {
    tableName: 'study_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default StudySession;
