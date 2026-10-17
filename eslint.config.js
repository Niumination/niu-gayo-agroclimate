// ESLint flat config (P6) — pengaman agar temuan aksesibilitas/JS tidak kembali.
// Fokus: aturan jsx-a11y inti dari docs/dev/11-RENCANA-DESIGN-UX.md §P6.
// Jalankan: npm run lint
// Catatan pemasangan: .npmrc menetapkan legacy-peer-deps=true karena
// eslint-plugin-jsx-a11y@6.10.2 belum mengakui peer eslint 10 (lihat CHANGELOG P6.1).
import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**', '.ssr-out/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      // 'latest' penting: berkas memakai import attributes (`with { type: 'json' }`)
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'jsx-a11y': jsxA11y, 'react-hooks': reactHooks },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Aturan yang paling sering menangkap temuan nyata di aplikasi ini
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['select', 'input', 'textarea'] }],
      // Hook React — komentar `eslint-disable react-hooks/exhaustive-deps` di App.jsx
      // hanya bermakna bila pluginnya terpasang.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Kode: variabel tak terpakai adalah tanda sisa pekerjaan — kecuali argumen berawalan _
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true, // pola `({ x, ...sisa })` untuk MEMBUANG x memang disengaja
      }],
      // `try { … } catch {}` di sekitar localStorage sah: penyimpanan bisa dilarang browser
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },
]
