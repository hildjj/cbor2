'use strict';
const fs = require('node:fs');
const path = require('node:path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: Object.values(pkg.exports).map(f => path.resolve(__dirname, f.replace('/lib/', '/src/').replace('.js', '.ts'))),
  out: 'docs',
  cleanOutputDir: true,
  sidebarLinks: {
    GitHub: 'https://github.com/hildjj/cbor2/',
    Documentation: 'http://hildjj.github.io/cbor2/',
    Playground: '/cbor2/playground/index.html',
    Spec: 'http://cbor.io/',
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ['static-first', 'alphabetical'],
  exclude: ['**/*.spec.ts'],
};
