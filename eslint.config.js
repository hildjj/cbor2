import base from '@cto.af/eslint-config';
import globals from '@cto.af/eslint-config/globals.js';
import jsdoc_ts from '@cto.af/eslint-config/jsdoc_ts.js';
import markdown from '@cto.af/eslint-config/markdown.js';
import mod from '@cto.af/eslint-config/module.js';
import ts from '@cto.af/eslint-config/ts.js';

export default [
  {
    ignores: [
      'lib/**',
      'web/dist/**',
      'dcbor-test-vectors/**',
      'web/playwright-report/**',
      'web/test-results/**',
      'test-vectors/*',
    ],
  },
  ...base,
  ...mod,
  ...ts,
  ...jsdoc_ts,
  ...markdown,
  {
    files: [
      'src/**.ts',
    ],
    rules: {
      // Lots of wrapper-object processing in this lib.
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
    },
  },
  {
    files: [
      '**/*.md/*.js',
    ],
    rules: {
      'no-new-wrappers': 'off',
    },
  },
  {
    files: [
      'web/**/*.js',
    ],
    rules: {
      'n/file-extension-in-import': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      'examples/**',
    ],
    rules: {
      'n/file-extension-in-import': 'off',
      'n/no-missing-import': 'off',
      'no-console': 'off',
    },
  },
];
