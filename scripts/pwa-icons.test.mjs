import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(repoRoot, 'client', 'public');

function pngSize(filePath) {
  const buf = readFileSync(filePath);
  assert.equal(buf.subarray(0, 8).toString('binary'), '\x89PNG\r\n\x1a\n');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test('PWA PNG 尺寸与既有主屏资源约定一致', () => {
  assert.deepEqual(pngSize(path.join(publicDir, 'icon-192.png')), { width: 384, height: 384 });
  assert.deepEqual(pngSize(path.join(publicDir, 'icon-512.png')), { width: 1024, height: 1024 });
  assert.deepEqual(pngSize(path.join(publicDir, 'icon-maskable-512.png')), {
    width: 1024,
    height: 1024,
  });
  assert.deepEqual(pngSize(path.join(publicDir, 'apple-touch-icon.png')), {
    width: 360,
    height: 360,
  });
});

test('SVG 图标用矢量路径绘制「学」，不依赖运行时 CJK 字体', () => {
  const icon = readFileSync(path.join(publicDir, 'icon.svg'), 'utf8');
  const maskable = readFileSync(path.join(publicDir, 'icon-maskable.svg'), 'utf8');

  for (const svg of [icon, maskable]) {
    assert.match(svg, /<linearGradient/);
    assert.match(svg, /<path d="/);
    assert.doesNotMatch(svg, /<text[\s>]/);
    assert.match(svg, /#0d9488|#14b8a6|#0f766e|#115e59/);
  }

  assert.match(icon, /rx="96"/);
  assert.match(maskable, /scale\(0\.82\)/);
  assert.doesNotMatch(maskable, /rx="96"/);
});

test('manifest 与 theme-color 使用青绿主题', () => {
  const manifest = JSON.parse(readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'));
  const html = readFileSync(path.join(repoRoot, 'client', 'index.html'), 'utf8');
  assert.equal(manifest.theme_color, '#0d9488');
  assert.match(html, /name="theme-color" content="#0d9488"/);
  const iconSrcs = manifest.icons.map((icon) => icon.src);
  assert.deepEqual(
    iconSrcs.sort(),
    ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/icon.svg'].sort()
  );
});
