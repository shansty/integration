import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import n from 'eslint-plugin-n';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1) Global ignores: never lint these paths
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'prisma/migrations/**',
      '**/*.d.ts',
      'eslint.config.*',
      "db.json",
    ],
  },
  // 2) Main rule set for all code
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    extends: [
      js.configs.recommended, // base JS rules
      ...tseslint.configs.recommended, // TS rules (syntax-level)
      ...tseslint.configs.stylistic, // optional TS style rules
      n.configs['flat/recommended'], // Node best practices
      eslintConfigPrettier, // turn off rules that clash with Prettier
    ],
    languageOptions: {
      parserOptions: {
        // Monorepo-friendly: TS-ESLint auto-finds the nearest tsconfig for each file
        projectService: true,
        // Path reference for relative tsconfig paths, etc.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefer the TS version of no-unused-vars
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Async Express handlers are common; this prevents false positives
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],

      // Logging is fine in a backend service; tune if you want stricter CI
      'no-console': 'off',

      // Node plugin + TS resolver overlap; we let TS resolver handle imports
      'n/no-missing-import': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
    },
  },
);
