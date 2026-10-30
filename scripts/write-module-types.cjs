const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

for (const [directory, type] of [['esm', 'module'], ['cjs', 'commonjs']]) {
  writeFileSync(resolve(__dirname, '..', 'dist', directory, 'package.json'),
    `${JSON.stringify({ type }, null, 2)}\n`);
}
