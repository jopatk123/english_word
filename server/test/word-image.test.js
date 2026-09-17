/**
 * 测试：单词记忆图片上传 / 读取 / 替换 / 下载 / 删除
 * JWT 与 API Token 均可访问；压缩后体积严格 ≤ 300KB。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import request from 'supertest';
import sharp from 'sharp';
import { initDB, User, Root, Word, WordRoot } from '../models/index.js';
import { createApp } from '../app.js';
import { generateToken } from '../middleware/auth.js';
import { createToken } from '../services/api-tokens.js';
import { getWordImagePath, WORD_IMAGE } from '../utils/wordImage.js';
import { removeUserWordImages } from '../services/word-image-store.js';

const suf = () => Date.now() + Math.random().toString(36).slice(2, 6);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const makeJpeg = (width, height) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 48, g: 110, b: 200 } },
  })
    .jpeg({ quality: 88 })
    .toBuffer();

let app;
let user;
let jwtToken;
let apiToken;
let word;

beforeAll(async () => {
  await initDB();
  app = createApp();
  user = await User.create({ username: `word_image_${suf()}`, password: 'x' });
  jwtToken = generateToken(user);
  apiToken = (await createToken(user.id, { name: 'image-script' })).token;

  const root = await Root.create({ name: `imgroot_${suf()}`, meaning: '图', userId: user.id });
  word = await Word.create({ name: `apple${suf()}`, meaning: '苹果', userId: user.id });
  await WordRoot.create({ wordId: word.id, rootId: root.id });
});

afterAll(async () => {
  await removeUserWordImages(user.id);
});

describe('单词记忆图片', () => {
  it('未登录不能访问', async () => {
    const res = await request(app).get(`/api/words/${word.id}/image`);
    expect(res.status).toBe(401);
  });

  it('JWT 可上传，并返回 hasImage，文件不超过 300KB', async () => {
    const jpeg = await makeJpeg(960, 720);
    const res = await request(app)
      .post(`/api/words/${word.id}/image`)
      .set(auth(jwtToken))
      .attach('image', jpeg, { filename: 'memory.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.data.hasImage).toBe(true);
    expect(res.body.data.bytes).toBeLessThanOrEqual(WORD_IMAGE.MAX_BYTES);
    expect(res.body.msg).toMatch(/已保存/);

    const stored = await fs.readFile(getWordImagePath(user.id, word.id));
    expect(stored.length).toBeLessThanOrEqual(WORD_IMAGE.MAX_BYTES);

    const detail = await request(app).get(`/api/words/${word.id}`).set(auth(jwtToken));
    expect(detail.body.data.hasImage).toBe(true);
    expect(detail.body.data).not.toHaveProperty('imageExt');
  });

  it('API Token 可以查看、下载和替换图片', async () => {
    const preview = await request(app).get(`/api/words/${word.id}/image`).set(auth(apiToken));
    expect(preview.status).toBe(200);
    expect(preview.headers['content-type']).toMatch(/image\/jpeg/);
    expect(preview.headers['content-disposition']).toMatch(/inline/);

    const download = await request(app)
      .get(`/api/words/${word.id}/image`)
      .query({ download: 1 })
      .set(auth(apiToken));
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toMatch(/attachment/);
    expect(download.headers['content-disposition']).toMatch(/memory\.jpg/);

    const replacement = await makeJpeg(1280, 800);
    const replaced = await request(app)
      .post(`/api/words/${word.id}/image`)
      .set(auth(apiToken))
      .attach('image', replacement, { filename: 'next.png', contentType: 'image/png' });
    expect(replaced.status).toBe(200);
    expect(replaced.body.msg).toMatch(/已替换/);
    expect(replaced.body.data.bytes).toBeLessThanOrEqual(WORD_IMAGE.MAX_BYTES);
  });

  it('过小的图片被拒绝', async () => {
    const tiny = await makeJpeg(200, 200);
    const res = await request(app)
      .post(`/api/words/${word.id}/image`)
      .set(auth(jwtToken))
      .attach('image', tiny, { filename: 'tiny.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/最短边/);
  });

  it('不能读取其他用户的图片', async () => {
    const other = await User.create({ username: `word_image_other_${suf()}`, password: 'x' });
    const otherToken = generateToken(other);
    const res = await request(app).get(`/api/words/${word.id}/image`).set(auth(otherToken));
    expect(res.status).toBe(404);
    expect(res.body.msg).toMatch(/不存在/);
  });

  it('删除图片后详情 hasImage 为 false，文件被清掉', async () => {
    const filePath = getWordImagePath(user.id, word.id);
    const res = await request(app).delete(`/api/words/${word.id}/image`).set(auth(jwtToken));
    expect(res.status).toBe(200);
    expect(res.body.data.hasImage).toBe(false);

    const detail = await request(app).get(`/api/words/${word.id}`).set(auth(jwtToken));
    expect(detail.body.data.hasImage).toBe(false);

    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it('删除单词时同步删除记忆图片文件', async () => {
    const jpeg = await makeJpeg(800, 800);
    await request(app)
      .post(`/api/words/${word.id}/image`)
      .set(auth(jwtToken))
      .attach('image', jpeg, { filename: 'memory.jpg', contentType: 'image/jpeg' });
    const filePath = getWordImagePath(user.id, word.id);
    await fs.access(filePath);

    const del = await request(app).delete(`/api/words/${word.id}`).set(auth(jwtToken));
    expect(del.status).toBe(200);
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});
