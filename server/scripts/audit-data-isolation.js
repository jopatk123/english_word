import sequelize from '../config/database.js';

const tables = await sequelize
  .getQueryInterface()
  .showAllTables()
  .catch(() => []);
const requiredTables = ['words', 'roots', 'word_roots'];
const missingTables = requiredTables.filter((table) => !tables.includes(table));

if (missingTables.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: '数据隔离审计无法执行，缺少必要数据表',
        missingTables,
      },
      null,
      2
    )
  );
  await sequelize.close();
  process.exit(1);
}

const [ownerlessWords] = await sequelize.query(`
  SELECT id, name
  FROM words
  WHERE user_id IS NULL
  ORDER BY id
`);

const [crossUserWordRoots] = await sequelize.query(`
  SELECT
    words.id AS wordId,
    words.name AS wordName,
    words.user_id AS wordUserId,
    GROUP_CONCAT(DISTINCT roots.user_id) AS linkedRootUserIds
  FROM words
  JOIN word_roots ON word_roots.word_id = words.id
  JOIN roots ON roots.id = word_roots.root_id
  GROUP BY words.id, words.name, words.user_id
  HAVING words.user_id IS NULL
    OR COUNT(DISTINCT roots.user_id) > 1
    OR SUM(CASE WHEN roots.user_id IS NULL OR roots.user_id != words.user_id THEN 1 ELSE 0 END) > 0
  ORDER BY words.id
`);

const [orphanWordRoots] = await sequelize.query(`
  SELECT word_roots.word_id AS wordId, word_roots.root_id AS rootId
  FROM word_roots
  LEFT JOIN words ON words.id = word_roots.word_id
  LEFT JOIN roots ON roots.id = word_roots.root_id
  WHERE words.id IS NULL OR roots.id IS NULL
  ORDER BY word_roots.word_id, word_roots.root_id
`);

const result = {
  ok:
    ownerlessWords.length === 0 && crossUserWordRoots.length === 0 && orphanWordRoots.length === 0,
  checkedTables: requiredTables,
  findings: {
    ownerlessWords,
    crossUserWordRoots,
    orphanWordRoots,
  },
};

console.log(JSON.stringify(result, null, 2));
await sequelize.close();

if (!result.ok) {
  process.exit(1);
}
