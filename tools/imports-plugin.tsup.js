/**
 * Taken from: https://github.com/egoist/tsup/issues/953#issuecomment-2294998890
 *
 * On TSUP when we compile to CJS, file extensions are set as .cjs but
 * in the compiled files, the imports are still pointing to .js files.
 *
 * This plugin replaces all the imports in CJS files to point to .cjs files.
 *
 * - require('./path') → require('./path.cjs') in `.cjs` files
 * - require('./path.js') → require('./path.cjs') in `.cjs` files
 * - from './path' → from './path.cjs' in `.cjs` files
 * - from './path.js' → from './path.cjs' in `.cjs` files
 * - from '../path' → from '../path.cjs' in `.cjs` files
 */

export const cjsImportsPlugin = () => ({
  name: 'cjs-imports',

  renderChunk(code) {
    if (this.format === 'cjs') {
      const regexCjs = /require\((?<quote>['"])(?<import>\.[^'"]+)\.js['"]\)/g;
      const regexEsm =
        /from(?<space>[\s]*)(?<quote>['"])(?<import>\.[^'"]+)\.js['"]/g;
      return {
        code: code
          .replace(regexCjs, 'require($<quote>$<import>.cjs$<quote>)')
          .replace(regexEsm, 'from$<space>$<quote>$<import>.cjs$<quote>'),
      };
    }
    return code;
  },
});
