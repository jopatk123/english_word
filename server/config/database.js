import { Sequelize } from 'sequelize';
import { getDbPath } from '../utils/env.js';

const dbPath = getDbPath();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

/**
 * SQLite 方言的连接管理器直接实现 getConnection，不走连接池的 afterConnect。
 * 因此 WAL / synchronous 必须在真正发出查询前显式设置。
 * journal_mode 会写入数据库文件；synchronous 只对当前连接生效，每次启动都要再设一次。
 */
export async function configureSqlite() {
  if (dbPath === ':memory:') return;
  await sequelize.query('PRAGMA journal_mode = WAL');
  await sequelize.query('PRAGMA synchronous = NORMAL');
}

export default sequelize;
