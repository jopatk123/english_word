import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');
export const childPackages = ['client', 'server'];

export function childInstallCommand(env = process.env) {
  return env.npm_command === 'ci' ? 'ci' : 'install';
}

/** 子目录安装必须脱离父级 npm 的配置，否则 --prefix 会被根目录的 npm_config_* 干扰。 */
export function childInstallEnv(env = process.env) {
  const next = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('npm_')) continue;
    next[key] = value;
  }
  return next;
}

function defaultRun(command, prefix, env) {
  const result = spawnSync('npm', [command, '--prefix', prefix], {
    cwd: path.dirname(prefix),
    env,
    stdio: 'inherit',
  });
  return { ok: result.status === 0, status: result.status ?? 1 };
}

export function installChildPackages({
  repoRoot = defaultRepoRoot,
  command = childInstallCommand(),
  env = process.env,
  run = defaultRun,
  packages = childPackages,
} = {}) {
  const childEnv = childInstallEnv(env);
  for (const name of packages) {
    const prefix = path.join(repoRoot, name);
    if (!existsSync(path.join(prefix, 'package.json'))) {
      return { ok: false, reason: 'missing-package', package: name };
    }
    const result = run(command, prefix, childEnv);
    if (!result.ok) {
      return { ok: false, reason: 'install-failed', package: name, status: result.status };
    }
  }
  return { ok: true, command, packages };
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const command = childInstallCommand();
  console.log(`安装前端与后端依赖（npm ${command}）`);
  const result = installChildPackages({ command });
  if (!result.ok) {
    if (result.reason === 'missing-package') {
      console.error(`缺少 ${result.package}/package.json`);
    } else {
      console.error(`${result.package} 依赖安装失败`);
    }
    process.exit(result.status ?? 1);
  }
}
