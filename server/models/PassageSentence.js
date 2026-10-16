import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PassageSentence = sequelize.define(
  'PassageSentence',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    passageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'passage_id',
      comment: '所属短文 ID',
      references: { model: 'passages', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'order_index',
      comment: '句子在全文中的顺序（从 0 开始）',
    },
    paragraphIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'paragraph_index',
      comment: '所在段落（从 0 开始）',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '英文句子',
    },
    translation: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '中文译文',
    },
  },
  {
    tableName: 'passage_sentences',
    timestamps: false,
    indexes: [
      {
        name: 'idx_passage_sentences_order_unique',
        unique: true,
        fields: ['passage_id', 'order_index'],
      },
    ],
  }
);

export default PassageSentence;
