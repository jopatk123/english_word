import { describe, expect, it } from 'vitest';
import { compressWordImageFile } from '../wordImageCompress.js';

describe('compressWordImageFile', () => {
  it('拒绝超过 5MB 的原始文件', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 10)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    await expect(compressWordImageFile(file)).rejects.toThrow(/5MB/);
  });
});
