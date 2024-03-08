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
    ],
  },
  ...base,
  ...mod,
  ...ts,
  ...jsdoc_ts,
  ...markdown,
  {
    files: [
      'web/**/*.js',
    ],
    rules: {
      'n/file-extension-in-import': 'off',
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
