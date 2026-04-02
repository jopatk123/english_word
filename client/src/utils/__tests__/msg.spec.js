/**
 * 测试：client/src/utils/msg.js
 *   - showMsg(msg, type, duration) 调用 ElMessage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock element-plus ElMessage
vi.mock('element-plus', () => ({
  ElMessage: vi.fn(),
}));

import { ElMessage } from 'element-plus';
import { showMsg } from '../msg.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('showMsg()', () => {
  it('默认调用 ElMessage 并传入正确参数', () => {
    showMsg('操作成功');
    expect(ElMessage).toHaveBeenCalledWith({
      message: '操作成功',
      type: 'info',
      duration: 3000,
    });
  });

  it('可以自定义 type 和 duration', () => {
    showMsg('出错了', 'error', 5000);
    expect(ElMessage).toHaveBeenCalledWith({
      message: '出错了',
      type: 'error',
      duration: 5000,
    });
  });

  it('success type 正确传入', () => {
    showMsg('保存成功', 'success');
    expect(ElMessage).toHaveBeenCalledWith({
      message: '保存成功',
      type: 'success',
      duration: 3000,
    });
  });

  it('warning type 正确传入', () => {
    showMsg('注意', 'warning', 2000);
    expect(ElMessage).toHaveBeenCalledWith({
      message: '注意',
      type: 'warning',
      duration: 2000,
    });
  });
});
