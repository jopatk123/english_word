import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Word = sequelize.define(
  'Word',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '单词',
    },
    meaning: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '含义',
    },
    phonetic: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '音标',
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '备注',
    },
    imageExt: {
      type: DataTypes.STRING(8),
      allowNull: true,
      field: 'image_ext',
      comment: '记忆图片扩展名，空表示未上传',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      comment: '所属用户ID',
    },
  },
  {
    tableName: 'words',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
  }
);

Word.prototype.toJSON = function toJSON() {
  const values = this.get({ plain: true });
  values.hasImage = Boolean(values.imageExt);
  delete values.imageExt;
  return values;
};

export default Word;
