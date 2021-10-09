module.exports = {
  env: {
    es2020: true,
    node: true,
    browser: true,
  },
  plugins: ['prettier'],
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    // default rules
    'no-console': 'warn',
    quotes: ['error', 'single'],
    'no-unused-vars': 'warn',
    'comma-dangle': ['error', 'always-multiline'],
    'max-len': ['warn', 109],
    'prettier/prettier': 'error',
  },
};
