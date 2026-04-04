import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Root = sequelize.define(
  'Root',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '词根',
    },
    meaning: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '核心含义',
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      comment: '所属用户ID',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default',
      comment: '是否为「未分类」默认词根（不可删除）',
    },
  },
  {
    tableName: 'roots',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
  }
);

export default Root;
