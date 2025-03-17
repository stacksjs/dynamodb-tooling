import { $ } from 'bun'
import process from 'node:process'
import { dts } from 'bun-plugin-dtsx'

console.log('Building...')

const result = await Bun.build({
  entrypoints: ['src/index.ts', 'bin/cli.ts'],
  target: 'bun',
  outdir: './dist',
  sourcemap: 'inline',
  external: ['confbox'],
  plugins: [dts()],
})

if (!result.success) {
  console.error('Build failed')
  for (const message of result.logs) {
    console.error(message)
  }
  process.exit(1)
}

await $`cp ./dist/src/index.js ./dist/index.js`
await $`rm -rf ./dist/src`
await $`cp ./dist/bin/cli.js ./dist/cli.js`
await $`rm -rf ./dist/bin`

console.log('Build successful!')
process.exit(0)
