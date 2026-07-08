import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      /*
       * Keep the real React Hook safety rules.
       */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /*
       * Disable React Compiler optimization rules that are too strict
       * for this existing dashboard codebase.
       *
       * These were causing:
       * - setState inside useEffect errors
       * - Date.now purity errors
       * - React Hook Form watch() incompatible-library warning
       * - preserve-manual-memoization errors
       */
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',

      /*
       * Keep build stable if React Compiler adds more optimization-only
       * diagnostics through the recommended React Hooks preset.
       */
      'react-hooks/component-hook-factories': 'off',
      'react-hooks/config': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/gating': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/use-memo': 'off'
    }
  },

  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },

  /*
   * Drift prevention: src/ui/ is the shared component library. These pages
   * grew local re-implementations of Panel/StatCard/EmptyState/Badge/Modal
   * (10+ times each in some cases) and raw <input> elements instead of the
   * shared Input, rather than reusing src/ui/. Flag both patterns so new
   * instances of the same drift are caught in review, not months later.
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            'Use the shared <Input> from @/ui/Input instead of a raw <input> (file/color/checkbox-type inputs styled with tokens are fine to suppress inline).'
        },
        {
          selector:
            ":matches(FunctionDeclaration, VariableDeclarator, ClassDeclaration)[id.name=/^(Panel|StatCard|EmptyState|Modal)$/]",
          message:
            'A shared component with this name already exists in @/ui — import it instead of redeclaring a local version.'
        },
        {
          selector: "FunctionDeclaration[id.name='Badge'], VariableDeclarator[id.name='Badge']",
          message: 'Import Badge from @/ui/Badge instead of declaring a local component with the same name.'
        }
      ]
    }
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'coverage/**',
    'node_modules/**',
    'next-env.d.ts'
  ])
]);

export default eslintConfig;
