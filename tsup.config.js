import {defineConfig} from 'tsup';

export default defineConfig({
  //
  // clean: true,
  dts: true,
  entry: ['src/index.ts'],
  format: 'esm',
  outDir: 'lib',
  sourcemap: false,
  splitting: false,
  target: 'es2022',
});
