/**
 * Prettier Real Worker
 * Uses the actual Prettier npm package (same engine as VS Code Prettier extension)
 * Runs in a dedicated Web Worker thread to avoid blocking the main UI thread.
 */

import * as prettier from 'prettier/standalone'
import babelPlugin from 'prettier/plugins/babel'
import estreePlugin from 'prettier/plugins/estree'
import typescriptPlugin from 'prettier/plugins/typescript'
import cssPlugin from 'prettier/plugins/postcss'
import htmlPlugin from 'prettier/plugins/html'
import markdownPlugin from 'prettier/plugins/markdown'

type PrettierMessage =
  | { type: 'format'; code: string; language: string; requestId: number }

function getParser(language: string): string {
  switch (language) {
    case 'typescript':
    case 'tsx':
      return 'typescript'
    case 'javascript':
    case 'javascriptreact':
    case 'jsx':
      return 'babel'
    case 'css':
    case 'scss':
    case 'less':
      return 'css'
    case 'html':
      return 'html'
    case 'markdown':
      return 'markdown'
    case 'json':
      return 'json'
    default:
      return 'babel'
  }
}

function getPlugins(parser: string) {
  switch (parser) {
    case 'typescript':
      return [typescriptPlugin, estreePlugin]
    case 'babel':
      return [babelPlugin, estreePlugin]
    case 'css':
      return [cssPlugin]
    case 'html':
      return [htmlPlugin]
    case 'markdown':
      return [markdownPlugin]
    default:
      return [babelPlugin, estreePlugin]
  }
}

self.addEventListener('message', async (event: MessageEvent<PrettierMessage>) => {
  const { type, code, language, requestId } = event.data

  if (type === 'format') {
    try {
      const parser = getParser(language)
      const plugins = getPlugins(parser)

      const formatted = await prettier.format(code, {
        parser,
        plugins,
        // Real Prettier defaults (same as VS Code extension defaults)
        printWidth: 80,
        tabWidth: 2,
        useTabs: false,
        semi: true,
        singleQuote: true,
        quoteProps: 'as-needed',
        jsxSingleQuote: false,
        trailingComma: 'es5',
        bracketSpacing: true,
        bracketSameLine: false,
        arrowParens: 'always',
        endOfLine: 'lf',
      })

      self.postMessage({ type: 'formatted', code: formatted, requestId, error: null })
    } catch (err: any) {
      self.postMessage({ type: 'formatted', code, requestId, error: err.message })
    }
  }
})
