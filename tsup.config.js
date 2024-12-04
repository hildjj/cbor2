import {defineConfig} from 'tsup';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = await fs.readdir(path.join(__dirname, 'src'));
const entry = files
  .filter(f => f.endsWith('.ts'))
  .map(f => path.join('src', f));

export default defineConfig({
  clean: true,
  dts: true,
  entry,
  format: ['esm', 'cjs'],
  minify: true,
  outDir: 'lib',
  sourcemap: false,
  splitting: false,
  target: 'es2022',
  bundle: false,
});
