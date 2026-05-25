/**
 * ESLint Real Worker
 * Uses the actual ESLint Linter class (same engine as VS Code ESLint extension)
 * The Linter class is browser-compatible — no Node.js APIs required.
 * Runs in a dedicated Web Worker thread to avoid blocking the main UI thread.
 */

import { Linter } from 'eslint'

const linter = new Linter({ configType: 'flat' })

type ESLintMessage = {
  type: 'lint'
  code: string
  language: string
  requestId: number
}

function getESLintLanguageOptions(language: string) {
  const isJSX = language === 'javascriptreact' || language === 'tsx'
  return {
    ecmaVersion: 2022 as const,
    sourceType: 'module' as const,
    parserOptions: {
      ecmaFeatures: { jsx: isJSX },
    },
  }
}

// Real ESLint rules — same ruleset as the VS Code ESLint extension defaults
const ESLINT_RULES: Linter.RulesRecord = {
  // Possible Problems
  'no-unused-vars': ['warn', { vars: 'all', args: 'after-used' }],
  'no-undef': 'error',
  'no-duplicate-case': 'error',
  'no-empty': 'warn',
  'no-unreachable': 'warn',
  'no-constant-condition': 'warn',

  // Best Practices
  'no-var': 'warn',
  'prefer-const': ['warn', { destructuring: 'any' }],
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'eqeqeq': ['warn', 'always'],
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-return-assign': 'warn',
  'no-throw-literal': 'warn',
  'prefer-template': 'warn',
  'no-useless-concat': 'warn',

  // Style (Prettier would override these, but useful standalone)
  'semi': ['warn', 'always'],
  'no-trailing-spaces': 'warn',
  'no-multiple-empty-lines': ['warn', { max: 2 }],

  // ES6+
  'arrow-body-style': 'off',
  'prefer-arrow-callback': 'warn',
  'object-shorthand': 'warn',
  'prefer-destructuring': 'off',
  'no-useless-rename': 'warn',
}

self.addEventListener('message', (event: MessageEvent<ESLintMessage>) => {
  const { type, code, language, requestId } = event.data

  if (type === 'lint') {
    // Only lint JS/TS — skip CSS, HTML, Markdown, JSON
    const lintable = ['javascript', 'javascriptreact', 'typescript', 'tsx']
    if (!lintable.includes(language)) {
      self.postMessage({ type: 'markers', markers: [], requestId })
      return
    }

    try {
      const messages = linter.verify(code, {
        languageOptions: getESLintLanguageOptions(language),
        rules: ESLINT_RULES,
      })

      // Map ESLint messages → Monaco marker format
      const markers = messages.map((msg) => ({
        // Monaco severity: 1=Hint, 2=Info, 3=Warning, 4=Error
        severity: msg.severity === 2 ? 4 : 3,
        message: `ESLint(${msg.ruleId ?? 'parse'}): ${msg.message}`,
        source: 'eslint',
        startLineNumber: msg.line ?? 1,
        startColumn: msg.column ?? 1,
        endLineNumber: msg.endLine ?? msg.line ?? 1,
        endColumn: msg.endColumn ?? (msg.column ?? 1) + 1,
      }))

      self.postMessage({ type: 'markers', markers, requestId })
    } catch (err: any) {
      // Parse errors — still show as a diagnostic
      self.postMessage({
        type: 'markers',
        markers: [{
          severity: 4,
          message: `ESLint: Parse error — ${err.message}`,
          source: 'eslint',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        }],
        requestId,
      })
    }
  }
})
