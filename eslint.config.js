import js from '@eslint/js';
import globals from 'globals';

const pluginGlobals = Object.fromEntries(
  [
    'document',
    'window',
    'navigator',
    'console',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'queueMicrotask',
    'TextEncoder',
    'TextDecoder',
    'atob',
    'btoa',
    'performance',
    'structuredClone',
    'URL',
    'Blob',
    'createImageBitmap',
    'OffscreenCanvas'
  ].map((name) => [name, 'readonly'])
);

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'tools/oneoff/**',
      'tools/tmp/**',
      'design/**',
      'docs/**',
      'tests/fixtures/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    // Browser globals are listed one by one: the full browser set would hide a
    // missing import behind window.status, window.name, History or Storage.
    languageOptions: { ecmaVersion: 2025, sourceType: 'module', globals: pluginGlobals },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Sanitizers strip control characters on purpose.
      'no-control-regex': 'off'
    }
  },
  {
    files: ['tests/**/*.mjs', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2025, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];
