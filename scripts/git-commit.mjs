#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  })

  if (result.error) {
    throw result.error
  }

  return result
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function usage() {
  console.log(`
Uso:
  npm run git:commit -- -m "mensaje del commit"
  npm run git:commit -- -m "mensaje" --push
  npm run git:commit -- --message "mensaje" --all

Opciones:
  -m, --message   Mensaje del commit (requerido)
  --all           Stagea todos los cambios (por defecto: true)
  --no-all        No stagea automaticamente (solo commit de lo ya staged)
  --push          Hace push al upstream de la rama actual despues del commit
  -h, --help      Muestra esta ayuda
`.trim())
}

const args = process.argv.slice(2)

let message = ''
let stageAll = true
let pushAfterCommit = false

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]

  if (arg === '-h' || arg === '--help') {
    usage()
    process.exit(0)
  }

  if (arg === '--push') {
    pushAfterCommit = true
    continue
  }

  if (arg === '--all') {
    stageAll = true
    continue
  }

  if (arg === '--no-all') {
    stageAll = false
    continue
  }

  if (arg === '-m' || arg === '--message') {
    const next = args[i + 1]
    if (!next || next.startsWith('-')) {
      fail('Debes indicar un mensaje despues de -m/--message.')
    }
    message = next.trim()
    i += 1
    continue
  }
}

if (!message) {
  fail('Falta el mensaje del commit. Usa -m "tu mensaje".')
}

const insideRepo = runGit(['rev-parse', '--is-inside-work-tree'], { capture: true })
if (insideRepo.status !== 0 || insideRepo.stdout.trim() !== 'true') {
  fail('Este directorio no es un repositorio Git.')
}

if (stageAll) {
  const addResult = runGit(['add', '-A'])
  if (addResult.status !== 0) {
    fail('No se pudieron stagear los cambios con git add -A.')
  }
}

const statusResult = runGit(['diff', '--cached', '--name-only'], { capture: true })
if (statusResult.status !== 0) {
  fail('No se pudo verificar el estado staged.')
}

if (!statusResult.stdout.trim()) {
  fail('No hay cambios staged para commitear.')
}

const commitResult = runGit(['commit', '-m', message])
if (commitResult.status !== 0) {
  fail('Fallo git commit.')
}

if (pushAfterCommit) {
  const branchResult = runGit(['branch', '--show-current'], { capture: true })
  const branch = branchResult.stdout.trim()
  if (!branch) {
    fail('No se pudo detectar la rama actual para hacer push.')
  }

  const pushResult = runGit(['push', '--set-upstream', 'origin', branch])
  if (pushResult.status !== 0) {
    fail('Fallo git push.')
  }
}

console.log('Commit completado correctamente.')
