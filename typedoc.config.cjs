'use strict';

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: [
    './src/*.ts',
  ],
  out: 'docs',
  cleanOutputDir: true,
  sidebarLinks: {
    GitHub: 'https://github.com/hildjj/cbor2/',
    Documentation: 'http://hildjj.github.io/cbor2/',
    Playground: 'http://hildjj.github.io/cbor2/example/',
    Spec: 'http://cbor.io/',
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ['static-first', 'alphabetical'],
};
