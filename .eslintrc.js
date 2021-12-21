module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  plugins: ['promise', '@typescript-eslint'],
  extends: [
    'standard',
    'standard-with-typescript',
    // 'plugin:@typescript-eslint/recommended',
    // 'plugin:promise/recommended',

    // this one maybe useless, but take a look
    // 'plugin:node/recommended',
    'prettier'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2020,
    project: './tsconfig.json'
  },
  rules: {
    eqeqeq: 2,
    '@typescript-eslint/strict-boolean-expressions': 0,
    '@typescript-eslint/restrict-plus-operands': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/naming-convention': 0,
    '@typescript-eslint/no-misused-promises': 0,
    '@typescript-eslint/restrict-template-expressions': 0,
    '@typescript-eslint/return-await': 0
  },
  ignorePatterns: ['/dist/**', '**/node_modules/**']
};
