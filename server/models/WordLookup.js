import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WordLookup = sequelize.define(
  'WordLookup',
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
    word: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: '规范化后的查询词',
    },
    phonetic: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '音标',
    },
    meaning: {
      type: DataTypes.STRING(80),
      allowNull: false,
      comment: '简短中文释义',
    },
    partOfSpeech: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      field: 'part_of_speech',
      comment: '词性释义 JSON',
    },
  },
  {
    tableName: 'word_lookups',
    timestamps: true,
    createdAt: 'create_time',
    updatedAt: 'update_time',
    indexes: [
      {
        name: 'idx_word_lookups_user_word_unique',
        unique: true,
        fields: ['user_id', 'word'],
      },
    ],
  }
);

export default WordLookup;
