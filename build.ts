import process from 'node:process'
import dts from 'bun-plugin-dts-auto'

console.log('Building...')

const result = await Bun.build({
  entrypoints: ['src/index.ts'],

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

console.log('Build successful!')
process.exit(0)
