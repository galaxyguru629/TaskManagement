/**
 * Discovers compiled *.test.js files under dist/ and runs them with node --test.
 * Works on Windows and Linux (npm does not expand globs consistently).
 */
import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function findTestFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return files;
    }
    throw err;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTestFiles(path)));
    } else if (entry.name.endsWith('.test.js')) {
      files.push(path);
    }
  }
  return files;
}

const testFiles = (await findTestFiles('dist')).sort();
if (testFiles.length === 0) {
  console.error('No compiled test files found under dist/. Run npm run build first.');
  process.exit(1);
}

/** Dummy values for config/env.ts — tests use pg-mem, not a real database or Auth0. */
const testEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  DATABASE_SSL: 'false',
  AUTH0_DOMAIN: 'example.auth0.com',
  AUTH0_AUDIENCE: 'https://task-dashboard-api',
};

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, ...testEnv },
});
process.exit(result.status ?? 1);
