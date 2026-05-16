import { describe, expect, it, vi } from 'vitest';
import { startServer } from '../index.js';
import { runDataIsolationAudit } from '../scripts/audit-data-isolation.js';

describe('startServer', () => {
  it('按依赖注入顺序启动服务并返回运行对象', async () => {
    const attach = vi.fn();
    const listen = vi.fn((_port, callback) => callback());
    const initDBFn = vi.fn();
    const createStudyTimerHubFn = vi.fn(() => ({ attach }));
    const createAppFn = vi.fn(({ studyTimerHub }) => ({ studyTimerHub }));
    const createServerFn = vi.fn(() => ({ listen }));
    const log = vi.fn();

    const result = await startServer({
      port: 4123,
      initDBFn,
      createStudyTimerHubFn,
      createAppFn,
      createServerFn,
      log,
    });

    expect(initDBFn).toHaveBeenCalledTimes(1);
    expect(createStudyTimerHubFn).toHaveBeenCalledTimes(1);
    expect(createAppFn).toHaveBeenCalledWith({
      studyTimerHub: expect.objectContaining({ attach }),
    });
    expect(createServerFn).toHaveBeenCalledWith(
      expect.objectContaining({ studyTimerHub: result.studyTimerHub })
    );
    expect(attach).toHaveBeenCalledWith(result.server);
    expect(listen).toHaveBeenCalledWith(4123, expect.any(Function));
    expect(log).toHaveBeenCalledWith('服务已启动: http://localhost:4123');
    expect(result.port).toBe(4123);
  });
});

describe('runDataIsolationAudit', () => {
  it('缺少必要表时返回不可执行结果', async () => {
    const sequelizeInstance = {
      getQueryInterface: () => ({
        showAllTables: vi.fn().mockResolvedValue(['users']),
      }),
    };

    const result = await runDataIsolationAudit(sequelizeInstance);
    expect(result).toEqual({
      ok: false,
      message: '数据隔离审计无法执行，缺少必要数据表',
      missingTables: ['words', 'roots', 'word_roots'],
    });
  });

  it('存在孤儿或跨用户关联时返回详细 findings', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[{ id: 1, name: 'orphan-word' }]])
      .mockResolvedValueOnce([
        [{ wordId: 2, wordName: 'cross-user-word', wordUserId: 7, linkedRootUserIds: '7,8' }],
      ])
      .mockResolvedValueOnce([[{ wordId: 3, rootId: 9 }]]);
    const sequelizeInstance = {
      getQueryInterface: () => ({
        showAllTables: vi.fn().mockResolvedValue(['words', 'roots', 'word_roots']),
      }),
      query,
    };

    const result = await runDataIsolationAudit(sequelizeInstance);
    expect(result.ok).toBe(false);
    expect(result.findings.ownerlessWords).toHaveLength(1);
    expect(result.findings.crossUserWordRoots).toHaveLength(1);
    expect(result.findings.orphanWordRoots).toHaveLength(1);
  });

  it('数据正常时返回 ok=true', async () => {
    const sequelizeInstance = {
      getQueryInterface: () => ({
        showAllTables: vi.fn().mockResolvedValue(['words', 'roots', 'word_roots']),
      }),
      query: vi.fn().mockResolvedValue([[]]),
    };

    const result = await runDataIsolationAudit(sequelizeInstance);
    expect(result).toEqual({
      ok: true,
      checkedTables: ['words', 'roots', 'word_roots'],
      findings: {
        ownerlessWords: [],
        crossUserWordRoots: [],
        orphanWordRoots: [],
      },
    });
  });
});
