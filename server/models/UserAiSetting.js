import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserAiSetting = sequelize.define(
  'UserAiSetting',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      comment: '所属用户 ID',
    },
    encryptedPayload: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'encrypted_payload',
      comment: 'AES-GCM 加密后的 AI Key 映射 JSON',
    },
    iv: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'AES-GCM 初始向量（base64url）',
    },
    authTag: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'auth_tag',
      comment: 'AES-GCM 认证标签（base64url）',
    },
  },
  {
    tableName: 'user_ai_settings',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
  }
);

export default UserAiSetting;
