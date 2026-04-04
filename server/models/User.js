import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: '用户名',
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '密码哈希',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
  }
);

export default User;
