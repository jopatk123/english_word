import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  childInstallCommand,
  childInstallEnv,
  installChildPackages,
} from './install-child-deps.mjs';

test('根目录 npm ci 时子包也用 ci，其余用 install', () => {
  assert.equal(childInstallCommand({ npm_command: 'ci' }), 'ci');
  assert.equal(childInstallCommand({ npm_command: 'install' }), 'install');
  assert.equal(childInstallCommand({}), 'install');
});

test('传给子进程的环境去掉 npm_ 配置', () => {
  const env = childInstallEnv({
    PATH: '/usr/bin',
    npm_command: 'ci',
    npm_config_prefix: '/repo',
  });
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.npm_command, undefined);
  assert.equal(env.npm_config_prefix, undefined);
});

test('按 client、server 顺序安装，并使用清理后的环境', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'english-word-deps-'));
  mkdirSync(path.join(root, 'client'));
  mkdirSync(path.join(root, 'server'));
  writeFileSync(path.join(root, 'client', 'package.json'), '{}');
  writeFileSync(path.join(root, 'server', 'package.json'), '{}');
  const calls = [];

  try {
    const result = installChildPackages({
      repoRoot: root,
      command: 'ci',
      env: { PATH: '/usr/bin', npm_config_prefix: '/repo' },
      run(command, prefix, env) {
        calls.push({ command, prefix, env });
        return { ok: true, status: 0 };
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(
      calls.map((call) => path.basename(call.prefix)),
      ['client', 'server']
    );
    assert.equal(calls[0].command, 'ci');
    assert.equal(calls[0].env.npm_config_prefix, undefined);
    assert.equal(calls[0].env.PATH, '/usr/bin');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('缺少 package.json 时停止且不再安装后续目录', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'english-word-deps-'));
  const calls = [];
  try {
    const result = installChildPackages({
      repoRoot: root,
      run(command, prefix) {
        calls.push(prefix);
        return { ok: true, status: 0 };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing-package');
    assert.equal(result.package, 'client');
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
