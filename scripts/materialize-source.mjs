import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, '.deploy-parts');
const parts = readdirSync(partsDir).filter((name) => name.endsWith('.b64')).sort();
if (parts.length !== 86) throw new Error(`Expected 86 source archive parts, found ${parts.length}.`);
const archivePath = join(tmpdir(), `coca-cola-source-${process.pid}.tar.gz`);
const buffers = parts.map((name) => Buffer.from(readFileSync(join(partsDir, name), 'utf8').trim(), 'base64'));
writeFileSync(archivePath, Buffer.concat(buffers));
execFileSync('tar', ['-xzf', archivePath, '-C', root], { stdio: 'inherit' });
unlinkSync(archivePath);
if (process.argv.includes('--cleanup')) {
  rmSync(partsDir, { recursive: true, force: true });
  rmSync(join(root, 'scripts', 'materialize-source.mjs'), { force: true });
  rmSync(join(root, 'package.bootstrap.json'), { force: true });
}
console.log(`Materialized ${parts.length} source parts into ${root}.`);
