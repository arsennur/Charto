import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/charto.js',
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
});
const source = readFileSync('dist/charto.js');
const sizes = { raw: source.length, gzip: gzipSync(source).length };
writeFileSync('demo/bundle-size.json', JSON.stringify(sizes));
console.log(`Charto: ${(sizes.raw / 1024).toFixed(2)} kB minified · ${(sizes.gzip / 1024).toFixed(2)} kB gzip · 0 runtime dependencies`);
