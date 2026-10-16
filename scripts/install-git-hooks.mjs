import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');
const defaultSourceDir = path.join(scriptDir, 'git-hooks');

export function installGitHooks({
  repoRoot = defaultRepoRoot,
  gitDir = path.join(repoRoot, '.git'),
  sourceDir = defaultSourceDir,
} = {}) {
  if (!existsSync(gitDir) || !existsSync(sourceDir)) {
    return { installed: false, reason: 'no-git-dir', hooks: [] };
  }

  const destDir = path.join(gitDir, 'hooks');
  mkdirSync(destDir, { recursive: true });

  const hooks = readdirSync(sourceDir).filter((name) => !name.startsWith('.'));
  for (const name of hooks) {
    const dest = path.join(destDir, name);
    copyFileSync(path.join(sourceDir, name), dest);
    chmodSync(dest, 0o755);
  }

  return { installed: true, hooks };
}

export function shouldSkipHookInstall(env = process.env) {
  return env.CI === 'true' || env.GITHUB_ACTIONS === 'true';
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if (shouldSkipHookInstall()) {
    console.log('CI 环境，跳过 Git hooks 安装');
  } else {
    const result = installGitHooks();
    if (result.installed) {
      console.log(`已安装 Git hooks：${result.hooks.join(', ')}`);
    } else {
      console.log('未找到 .git，跳过 Git hooks 安装');
    }
  }
}
