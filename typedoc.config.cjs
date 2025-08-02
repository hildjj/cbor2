'use strict';
const fs = require('node:fs');
const path = require('node:path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));

/** @import {TypeDocOptions} from 'typedoc' */
/** @type {TypeDocOptions} */
module.exports = {
  entryPoints: Object.values(pkg.exports).map(f => path.resolve(__dirname, f.replace('/lib/', '/src/').replace('.js', '.ts'))),
  out: 'docs',
  cleanOutputDir: true,
  sidebarLinks: {
    'Playground': '/cbor2/playground/index.html',
    'cbor-edn': 'https://github.com/hildjj/cbor-edn',
    'GitHub': 'https://github.com/hildjj/cbor2/',
    'Spec': 'http://cbor.io/',
    'Documentation': 'http://hildjj.github.io/cbor2/',
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ['static-first', 'alphabetical'],
  exclude: ['**/*.spec.ts'],
};
