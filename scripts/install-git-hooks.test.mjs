import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { installGitHooks, shouldSkipHookInstall } from './install-git-hooks.mjs';

test('CI 环境不安装 hooks', () => {
  assert.equal(shouldSkipHookInstall({ CI: 'true' }), true);
  assert.equal(shouldSkipHookInstall({ GITHUB_ACTIONS: 'true' }), true);
  assert.equal(shouldSkipHookInstall({}), false);
});

test('把 git-hooks 复制到 .git/hooks 并保留内容', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'english-word-hooks-'));
  const gitDir = path.join(root, '.git');
  const sourceDir = path.join(root, 'git-hooks');
  mkdirSync(gitDir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });
  const hookBody = '#!/bin/sh\necho ok\n';
  writeFileSync(path.join(sourceDir, 'pre-push'), hookBody);
  chmodSync(path.join(sourceDir, 'pre-push'), 0o644);

  try {
    const result = installGitHooks({ repoRoot: root, gitDir, sourceDir });
    assert.deepEqual(result, { installed: true, hooks: ['pre-push'] });
    assert.equal(readFileSync(path.join(gitDir, 'hooks', 'pre-push'), 'utf8'), hookBody);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('没有 .git 时跳过', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'english-word-hooks-'));
  try {
    const result = installGitHooks({
      repoRoot: root,
      gitDir: path.join(root, '.git'),
      sourceDir: path.join(root, 'missing'),
    });
    assert.equal(result.installed, false);
    assert.deepEqual(result.hooks, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
