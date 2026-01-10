module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, node: true, es6: true },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  settings: { react: { version: 'detect' } },
  globals: {
    apiFetch: 'readonly',
    wp: 'readonly',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-case-declarations': 'off',
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.js', '**/*.test.jsx'],
      env: { jest: true },
    },
  ],
};
