import {cjsImportsPlugin} from './tools/imports-plugin.tsup.js';
import {defineConfig} from 'tsup';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all TypeScript files in the src directory as entry points
const files = await fs.readdir(path.join(__dirname, 'src'));
const entry = files
  .filter(f => f.endsWith('.ts'))
  .map(f => path.join('src', f));

const commonSettings = {
  clean: true,
  dts: {
    resolve: true, // Ensures all dependencies are included
    entry, // Generate `.d.ts` for each entry file
  },
  entry,
  minify: false,
  sourcemap: true,
  splitting: false,
  target: 'es2022',
  bundle: false,
  cjsInterop: true,
};

export default defineConfig([
  // ESM configuration
  {
    ...commonSettings,
    format: ['esm'],
    outDir: 'lib',
  },
  // CJS configuration
  {
    ...commonSettings,
    format: ['cjs'],
    outDir: 'lib/cjs',
    plugins: [cjsImportsPlugin()],
  },
]);
