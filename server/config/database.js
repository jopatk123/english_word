import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import '../utils/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../data/words.db');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

export default sequelize;
