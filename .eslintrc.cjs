'use strict';

module.exports = {
  root: true,
  extends: [
    '@cto.af/eslint-config/typescript',
    '@cto.af/eslint-config/modules',
    '@cto.af/eslint-config/jsdoc',
    'plugin:markdown/recommended',
  ],
  ignorePatterns: [
    'node_modules/',
    'docs/',
    'lib/',
  ],
  parserOptions: {
    ecmaVersion: '2022',
    project: 'tsconfig.json',
  },
  rules: {
    'jsdoc/no-undefined-types': 'off', // Switch to typedoc
    'jsdoc/require-param-type': 'off', // Not needed in TS
    'jsdoc/require-returns-type': 'off', // Not needed in TS
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'lines-around-comment': 'off',
        '@typescript-eslint/lines-around-comment': ['error', {
          allowBlockStart: true,
          allowClassStart: true,
          allowEnumStart: true,
          allowInterfaceStart: true,
          allowModuleStart: true,
          allowTypeStart: true,
        }],
        '@typescript-eslint/lines-between-class-members': ['error', 'always', {
          exceptAfterSingleLine: true,
        }],
        'object-curly-spacing': 'off',
        '@typescript-eslint/object-curly-spacing': ['error', 'never'],
      },
    },
    {
      files: ['**/*.md/*.js'],
      rules: {
        'no-console': 'off',
        'n/no-missing-import': 'off',
      },
    },
  ],
};
