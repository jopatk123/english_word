import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ApiToken = sequelize.define(
  'ApiToken',
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
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Token 显示名称',
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: 'token_hash',
      comment: 'HMAC-SHA256(token, API_TOKEN_PEPPER) 十六进制摘要',
    },
    tokenPrefix: {
      type: DataTypes.STRING(16),
      allowNull: false,
      field: 'token_prefix',
      comment: '明文 Token 前 16 位，仅用于列表识别',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
      comment: '过期时间，空表示永不过期',
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at',
      comment: '最近一次成功鉴权时间（节流写入）',
    },
  },
  {
    tableName: 'api_tokens',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['expires_at'] },
      { fields: ['token_prefix'] },
      { unique: true, fields: ['token_hash'] },
    ],
  }
);

export default ApiToken;
