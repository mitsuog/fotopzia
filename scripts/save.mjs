#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

const hasMessageFlag = args.includes('-m') || args.includes('--message')
const hasHelpFlag = args.includes('-h') || args.includes('--help')

function buildDefaultMessage() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  return `chore: save snapshot ${stamp}`
}

const forwardedArgs = [...args]

if (!hasHelpFlag && !hasMessageFlag) {
  forwardedArgs.unshift(buildDefaultMessage())
  forwardedArgs.unshift('-m')
}

const result = spawnSync(process.execPath, ['scripts/git-commit.mjs', ...forwardedArgs], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
