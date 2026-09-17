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
    // VIRTUAL + getter：保证 hasImage 在直接查询与嵌套 include 两种序列化路径下都存在。
    // 仅靠自定义 toJSON 时，Word 作为其他模型（如 WordReview）的 include 返回，
    // Sequelize 会走 get({ plain: true }) 而绕过 toJSON，导致 hasImage 丢失。
    hasImage: {
      type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['imageExt']),
      get() {
        return Boolean(this.getDataValue('imageExt'));
      },
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
  // hasImage 已由 VIRTUAL getter 在 get({ plain: true }) 中生成，这里只负责隐藏内部字段
  const values = this.get({ plain: true });
  delete values.imageExt;
  return values;
};

export default Word;
