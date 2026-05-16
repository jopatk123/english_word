import { Sequelize } from 'sequelize';
import { getDbPath } from '../utils/env.js';

const dbPath = getDbPath();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

// Enable WAL mode and set synchronous=NORMAL on every new connection for better
// concurrent read performance and lower write latency.
sequelize.addHook(
  'afterConnect',
  (connection) =>
    new Promise((resolve, reject) => {
      connection.run('PRAGMA journal_mode=WAL', (err) => {
        if (err) {
          reject(err);
          return;
        }
        connection.run('PRAGMA synchronous=NORMAL', (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      });
    })
);

export default sequelize;
