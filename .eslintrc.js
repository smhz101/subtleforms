module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, node: true, es6: true },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  settings: { react: { version: 'detect' } },
  globals: {
    globalThis: 'readonly',
    apiFetch: 'readonly',
    wp: 'readonly',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-case-declarations': 'off',
    // Rules of hooks are errors — a violation crashes the rendered tree
    // (see React error #310). Exhaustive-deps is a warning so we can land
    // intentional mount-only effects with a disable comment.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.js', '**/*.test.jsx'],
      env: { jest: true },
    },
  ],
};
