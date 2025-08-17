#!/usr/bin/env node
// ESM wrapper for the compiled CLI
import('../dist/cli/index.js').catch((err) => {
  console.error('Failed to launch CLI:', err)
  process.exit(1)
})
