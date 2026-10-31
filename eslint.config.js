import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default [
  {
    ignores: [
      'build/**',
      'dist/**',
      '.netlify/**',
      '.svelte-kit/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // New recommended rules in eslint-plugin-svelte 3. The current app does not satisfy them.
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/infinite-reactive-loop': 'off',
      'svelte/require-each-key': 'off',
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/no-immutable-reactive-statements': 'off',
      'svelte/no-unused-svelte-ignore': 'off',
      'svelte/no-reactive-literals': 'off',
      'svelte/no-reactive-functions': 'off',
      'svelte/no-dom-manipulating': 'off'
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        svelteConfig
      }
    }
  }
];
