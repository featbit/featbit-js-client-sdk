// Run after building. Retain the temporary consumer for debugging; never delete it.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '..');
const consumer = mkdtempSync(join(tmpdir(), 'featbit-package-'));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this check with npm run test:package');
function run(command, args, cwd = consumer) {
  return execFileSync(command, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
}
console.log(`Package consumer: ${consumer}`);
const packed = JSON.parse(run(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', consumer], root));
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
console.log(run(process.execPath, [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', join(consumer, packed[0].filename)]));
const name = '@featbit/js-client-sdk';
const check = `import assert from 'node:assert/strict'; import { FbClientBuilder } from '${name}'; assert.equal(typeof FbClientBuilder, 'function'); const sdk = await import('${name}'); assert.equal(sdk.FbClientBuilder, FbClientBuilder);`;
run(process.execPath, ['--input-type=module', '-e', check]);
run(process.execPath, ['--input-type=commonjs', '-e', `require('node:assert/strict').equal(typeof require('${name}').FbClientBuilder, 'function')`]);

for (const extension of ['mts', 'cts', 'ts']) {
  const file = `consumer.${extension}`;
  writeFileSync(join(consumer, file), `import { FbClientBuilder, IOptions } from '${name}';\nexport const builder: typeof FbClientBuilder = FbClientBuilder;\nexport type Options = IOptions;\n`);
  const bundler = extension === 'ts';
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2020',
    '--module', bundler ? 'ESNext' : 'NodeNext', '--moduleResolution', bundler ? 'bundler' : 'NodeNext', file]);
}

const umdDirectory = join(consumer, 'node_modules/@featbit/js-client-sdk/dist/umd');
const umdFiles = readdirSync(umdDirectory).filter(file => file.endsWith('.js'));
assert.ok(umdFiles.length > 0, 'UMD output missing');
for (const file of umdFiles) {
  const browser = {};
  runInNewContext(readFileSync(join(umdDirectory, file), 'utf8'), browser);
  assert.equal(typeof browser.FbClientBuilder, 'function', `${file} browser global`);
}
console.log('Passed: packed ESM static/dynamic import, CJS require, NodeNext ESM/CJS types, bundler types, UMD browser globals.');
