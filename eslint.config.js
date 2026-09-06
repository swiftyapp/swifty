import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'src-tauri'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended
    ],
    languageOptions: { ecmaVersion: 2020 },
    plugins: {
      'react-refresh': reactRefresh
    },
    rules: {
      // TODO(react-compiler): revisit once the async hooks below stop clearing
      // their own output.
      //
      // Off for the whole tree, on 5 sites that are all one pattern: a hook
      // that kicks off an async call in an effect and synchronously clears the
      // previous answer first, so a caller never renders the *last* input's
      // result against the current one — `useRevealed` (a stale reveal is the
      // previous entry's secrets), `useOtp`, `useSshKey`, `useStrength` and
      // `Edit/useDraft`. React's answer to this is remounting on a `key`, which
      // would push a reset into every call site of all five; the setState is
      // deliberate, cheap (it runs once per input change, not per render) and
      // load-bearing. Disabled here rather than with five inline comments so
      // there is one place to reverse the decision.
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ]
    }
  }
)
