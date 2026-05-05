import { Sequelize } from 'sequelize';
import { getDbPath } from '../utils/env.js';

const dbPath = getDbPath();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

export default sequelize;
