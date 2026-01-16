import type { ESLintConfig } from '@stacksjs/eslint-config'
import stacks from '@stacksjs/eslint-config'

const config: ESLintConfig = stacks({
  ignores: ['todo.md'],
  stylistic: {
    indent: 2,
    quotes: 'single',
  },

  typescript: true,
  jsonc: true,
  yaml: true,

  rules: {
    // Allow global process and Buffer (standard in Node.js/Bun)
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    // Allow new for side effects (e.g., new URL() for validation)
    'no-new': 'off',
    // Allow console.log in CLI commands and logger
    'no-console': 'off',
    // Allow constructor names starting with lowercase (modelClass pattern)
    'new-cap': 'off',
    // Allow lexical declarations in case blocks (common pattern)
    'no-case-declarations': 'off',
    // Allow assignment in while loops (common regex exec pattern)
    'no-cond-assign': 'off',
    // Allow empty catch blocks
    'no-empty': 'off',
    // Allow Function constructor (used for dynamic validation)
    'no-new-func': 'off',
    // Allow multiple statements per line in tests
    'style/max-statements-per-line': 'off',
  },
})

export default config
