import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'backend/**', 'frontend/**', 'api/**', 'node_modules/**']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': 'off', // Disabled to focus on critical errors
      'react-hooks/set-state-in-effect': 'warn', // Downgraded to warning (best practice, not breaking)
      'no-empty': 'warn', // Downgraded to warning
      'react-hooks/exhaustive-deps': 'warn', // Downgraded to warning
    },
  },
])
